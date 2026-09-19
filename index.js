require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
    REST, 
    Routes, 
    Events, 
    SlashCommandBuilder, 
    ApplicationIntegrationType, 
    InteractionContextType, 
    ChannelType, 
    PermissionFlagsBits, 
    MessageFlags 
} = require('discord.js');
const Groq = require('groq-sdk');
const Parser = require('rss-parser');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const parser = new Parser();

// Global State
let isTaped = false;
let shortTermMemory = new Map(); // channelId -> array of { role, content }
let lastRSSCheck = { tiktok: null, youtube: null };

const SYSTEM_INSTRUCTION = "You are Skelerix, a helpful, energetic Discord bot. Keep answers engaging, natural, and clear.";

const mufflePhrases = [
    "Mmph! Mmmph!",
    "Mmm-mmmgh!",
    "Mff! Mmph-mm!",
    "Mmmph, mmph!",
    "Mmmgh... mmff!"
];

function getRandomMuffle() {
    return mufflePhrases[Math.floor(Math.random() * mufflePhrases.length)];
}

async function askAI(sysPrompt, userPrompt) {
    const res = await groq.chat.completions.create({
        messages: [
            { role: "system", content: sysPrompt },
            { role: "user", content: userPrompt }
        ],
        model: "llama-3.3-70b-versatile"
    });
    return res.choices[0]?.message?.content || "No response received.";
}

// Enable User Install / DM / Group Contexts
const enableUserInstall = (builder) => {
    return builder
        .setIntegrationTypes([
            ApplicationIntegrationType.GuildInstall, 
            ApplicationIntegrationType.UserInstall
        ])
        .setContexts([
            InteractionContextType.Guild, 
            InteractionContextType.BotDM, 
            InteractionContextType.PrivateChannel
        ]);
};

// ==========================================
// SLASH COMMAND DEFINITIONS
// ==========================================
const commandsList = [
    enableUserInstall(
        new SlashCommandBuilder()
            .setName('sai')
            .setDescription('Ask Skelerix AI anything.')
            .addStringOption(o => o.setName('prompt').setDescription('What to ask?').setRequired(true))
    ),
    enableUserInstall(
        new SlashCommandBuilder()
            .setName('saireset')
            .setDescription("Clear Skelerix's short-term chat memory for this channel.")
    ),
    enableUserInstall(
        new SlashCommandBuilder()
            .setName('ping')
            .setDescription('Check Skelerix status, bot latency, and AI response speed.')
    ),
    enableUserInstall(
        new SlashCommandBuilder()
            .setName('update')
            .setDescription('Manually trigger an RSS feed check for TikTok and YouTube updates.')
    ),
    enableUserInstall(
        new SlashCommandBuilder()
            .setName('gameupd')
            .setDescription('Post an official game update announcement.')
            .addChannelOption(o => 
                o.setName('channel')
                 .setDescription('The target channel to send the announcement to')
                 .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                 .setRequired(true)
            )
            .addStringOption(o => 
                o.setName('game')
                 .setDescription('Name of the game being updated')
                 .setRequired(true)
            )
            .addStringOption(o => 
                o.setName('version')
                 .setDescription('Update version (e.g., v1.2.0 or Beta 2.0)')
                 .setRequired(true)
            )
            .addStringOption(o => 
                o.setName('logs')
                 .setDescription('The update logs / patch notes (Use \n for new lines)')
                 .setRequired(true)
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    ),
    enableUserInstall(
        new SlashCommandBuilder()
            .setName('coinflip')
            .setDescription('Flip a coin! Heads or Tails?')
    ),
    enableUserInstall(
        new SlashCommandBuilder()
            .setName('roll')
            .setDescription('Roll a dice.')
            .addIntegerOption(o => o.setName('sides').setDescription('Number of sides (default 6)').setRequired(false))
    ),
    enableUserInstall(
        new SlashCommandBuilder()
            .setName('poll')
            .setDescription('Create a quick interactive poll.')
            .addStringOption(o => o.setName('question').setDescription('The poll question').setRequired(true))
    ),
    enableUserInstall(
        new SlashCommandBuilder()
            .setName('serverinfo')
            .setDescription('Check out community stats.')
    ),
    enableUserInstall(
        new SlashCommandBuilder()
            .setName('timeout')
            .setDescription('Timeout a disruptive user.')
            .addUserOption(o => o.setName('user').setDescription('The user to timeout').setRequired(true))
            .addIntegerOption(o => o.setName('duration').setDescription('Duration in minutes').setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    ),
    enableUserInstall(
        new SlashCommandBuilder()
            .setName('tape')
            .setDescription("Put tape over Skelerix's mouth (Owner only).")
            .addBooleanOption(o => o.setName('status').setDescription('True to tape, False to remove tape').setRequired(true))
    ),
    enableUserInstall(
        new SlashCommandBuilder()
            .setName('remind')
            .setDescription('Set a reminder.')
            .addIntegerOption(o => o.setName('minutes').setDescription('Time in minutes from now').setRequired(true))
            .addStringOption(o => o.setName('task').setDescription('What to remind you about').setRequired(true))
    ),
    enableUserInstall(
        new SlashCommandBuilder()
            .setName('stats')
            .setDescription('Show bot statistics.')
    ),
    enableUserInstall(
        new SlashCommandBuilder()
            .setName('userinfo')
            .setDescription('Show user information.')
            .addUserOption(o => o.setName('target').setDescription('The user to inspect').setRequired(false))
    ),
    enableUserInstall(
        new SlashCommandBuilder()
            .setName('choose')
            .setDescription('Randomly choose an option from a comma-separated list.')
            .addStringOption(o => o.setName('options').setDescription('Options separated by commas').setRequired(true))
    ),
    enableUserInstall(
        new SlashCommandBuilder()
            .setName('8ball')
            .setDescription('Ask the magic 8-ball a question.')
            .addStringOption(o => o.setName('question').setDescription('Your question').setRequired(true))
    ),
    enableUserInstall(
        new SlashCommandBuilder()
            .setName('define')
            .setDescription('Define a word or phrase.')
            .addStringOption(o => o.setName('term').setDescription('Word or phrase to define').setRequired(true))
    ),
    enableUserInstall(
        new SlashCommandBuilder()
            .setName('translate')
            .setDescription('Translate text to a target language.')
            .addStringOption(o => o.setName('text').setDescription('Text to translate').setRequired(true))
            .addStringOption(o => o.setName('language').setDescription('Target language').setRequired(true))
    )
].map(c => c.toJSON());

// ==========================================
// RSS CHECKER LOGIC
// ==========================================
async function checkRSSFeeds() {
    const channelId = process.env.RSS_CHANNEL_ID;
    if (!channelId) return;

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) return;

    if (process.env.TIKTOK_RSS_URL) {
        try {
            const feed = await parser.parseURL(process.env.TIKTOK_RSS_URL);
            if (feed.items.length > 0) {
                const latest = feed.items[0];
                if (lastRSSCheck.tiktok !== latest.link) {
                    if (lastRSSCheck.tiktok !== null) {
                        await channel.send(`ğŸµ **New TikTok Video!**
${latest.title || 'Check it out:'}
${latest.link}`);
                    }
                    lastRSSCheck.tiktok = latest.link;
                }
            }
        } catch (e) {
            console.error('[RSS ERROR - TikTok]:', e.message);
        }
    }

    if (process.env.YOUTUBE_RSS_URL) {
        try {
            const feed = await parser.parseURL(process.env.YOUTUBE_RSS_URL);
            if (feed.items.length > 0) {
                const latest = feed.items[0];
                if (lastRSSCheck.youtube !== latest.link) {
                    if (lastRSSCheck.youtube !== null) {
                        await channel.send(`ğŸ”´ **New YouTube Video!**
**${latest.title}**
${latest.link}`);
                    }
                    lastRSSCheck.youtube = latest.link;
                }
            }
        } catch (e) {
            console.error('[RSS ERROR - YouTube]:', e.message);
        }
    }
}

// ==========================================
// COMMAND HANDLERS
// ==========================================
const commandHandlers = {
    async sai(interaction) {
        const prompt = interaction.options.getString('prompt');
        await interaction.deferReply();

        try {
            const reply = await askAI(SYSTEM_INSTRUCTION, prompt);
            const safeReply = reply.length > 2000 ? `${reply.slice(0, 1997)}...` : reply;
            return interaction.editReply(safeReply);
        } catch (err) {
            return interaction.editReply(`âš ï¸ Error: \`${err.message}\``);
        }
    },

    async saireset(interaction) {
        shortTermMemory.delete(interaction.channelId);
        return interaction.reply({ content: 'ğŸ§¹ Short-term AI chat memory for this channel has been cleared!', flags: MessageFlags.Ephemeral });
    },

    async ping(interaction) {
        const start = Date.now();
        await interaction.deferReply();
        const apiLatency = Date.now() - start;

        let aiLatency = 'N/A';
        try {
            const aiStart = Date.now();
            await askAI('System test', 'Ping');
            aiLatency = `${Date.now() - aiStart}ms`;
        } catch (e) {
            aiLatency = 'Error';
        }

        return interaction.editReply(
            `ğŸ“ **Pong!**
` +
            `â€¢ Bot Latency: \`${apiLatency}ms\`
` +
            `â€¢ WebSocket Latency: \`${client.ws.ping}ms\`
` +
            `â€¢ Groq AI Speed: \`${aiLatency}\``
        );
    },

    async update(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        await checkRSSFeeds();
        return interaction.editReply('ğŸ”„ RSS feed check completed!');
    },

    async gameupd(interaction) {
        const targetChannel = interaction.options.getChannel('channel');
        const gameName = interaction.options.getString('game');
        const version = interaction.options.getString('version');
        const rawLogs = interaction.options.getString('logs');

        const formattedLogs = rawLogs.split('\n').join('
');

        const embed = {
            color: 0x5865F2,
            title: `ğŸ® ${gameName} - Update ${version}`,
            description: formattedLogs,
            timestamp: new Date().toISOString(),
            footer: { text: `Posted by ${interaction.user.username}` }
        };

        try {
            await targetChannel.send({ embeds: [embed] });
            return interaction.reply({ content: `âœ… Game update announcement posted to ${targetChannel}!`, flags: MessageFlags.Ephemeral });
        } catch (err) {
            return interaction.reply({ content: `âŒ Failed to send announcement: ${err.message}`, flags: MessageFlags.Ephemeral });
        }
    },

    async coinflip(interaction) {
        const result = Math.random() < 0.5 ? 'ğŸª™ **Heads!**' : 'ğŸª™ **Tails!**';
        return interaction.reply(result);
    },

    async roll(interaction) {
        const sides = interaction.options.getInteger('sides') || 6;
        const result = Math.floor(Math.random() * sides) + 1;
        return interaction.reply(`ğŸ² You rolled a **${result}** (1-${sides})!`);
    },

    async poll(interaction) {
        const question = interaction.options.getString('question');
        await interaction.reply({ content: `ğŸ“Š **Poll:** ${question}` });
        const msg = await interaction.fetchReply();
        await msg.react('ğŸ‘');
        await msg.react('ğŸ‘');
    },

    async serverinfo(interaction) {
        if (!interaction.guild) {
            return interaction.reply({ content: 'This command can only be used in a server!', flags: MessageFlags.Ephemeral });
        }

        const guild = interaction.guild;
        return interaction.reply(
            `ğŸ° **Server Info for ${guild.name}**
` +
            `â€¢ Total Members: \`${guild.memberCount}\`
` +
            `â€¢ Created On: <t:${Math.floor(guild.createdTimestamp / 1000)}:D>
` +
            `â€¢ Server ID: \`${guild.id}\``
        );
    },

    async timeout(interaction) {
        const targetUser = interaction.options.getUser('user');
        const duration = interaction.options.getInteger('duration');

        if (!interaction.guild) {
            return interaction.reply({ content: 'This command can only be used in a server!', flags: MessageFlags.Ephemeral });
        }

        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
        if (!member) {
            return interaction.reply({ content: 'User not found in this server.', flags: MessageFlags.Ephemeral });
        }

        try {
            await member.timeout(duration * 60 * 1000, `Timed out by ${interaction.user.tag}`);
            return interaction.reply(`â³ **${targetUser.username}** has been timed out for ${duration} minute(s).`);
        } catch (err) {
            return interaction.reply({ content: `âŒ Failed to timeout user: ${err.message}`, flags: MessageFlags.Ephemeral });
        }
    },

    async tape(interaction) {
        const status = interaction.options.getBoolean('status');
        isTaped = status;

        if (isTaped) {
            return interaction.reply('ğŸ“¦ Tape has been placed over Skelerix's mouth. Bot is now muted!');
        } else {
            return interaction.reply('ğŸ—£ï¸ Tape removed! Skelerix can talk again.');
        }
    },

    async remind(interaction) {
        const minutes = interaction.options.getInteger('minutes');
        const task = interaction.options.getString('task');

        await interaction.reply({ content: `â° Reminder set for **${minutes} minute(s)**: "${task}"`, flags: MessageFlags.Ephemeral });

        setTimeout(async () => {
            try {
                await interaction.user.send(`â° **Reminder:** ${task}`);
            } catch (err) {
                if (interaction.channel) {
                    await interaction.channel.send(`â° <@${interaction.user.id}> **Reminder:** ${task}`);
                }
            }
        }, minutes * 60 * 1000);
    },

    async stats(interaction) {
        const uptime = Math.floor(client.uptime / 1000);
        const hours = Math.floor(uptime / 3600);
        const mins = Math.floor((uptime % 3600) / 60);
        const secs = uptime % 60;

        return interaction.reply(
            `ğŸ“Š **Skelerix Bot Statistics**
` +
            `â€¢ Uptime: \`${hours}h ${mins}m ${secs}s\`
` +
            `â€¢ Servers: \`${client.guilds.cache.size}\`
` +
            `â€¢ Memory Usage: \`${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB\`
` +
            `â€¢ Engine: \`Node.js ${process.version}\` | \`discord.js v14\``
        );
    },

    async userinfo(interaction) {
        const target = interaction.options.getUser('target') || interaction.user;
        const member = interaction.guild ? await interaction.guild.members.fetch(target.id).catch(() => null) : null;

        let info = `ğŸ‘¤ **User Info for ${target.tag}**
` +
                   `â€¢ Account Created: <t:${Math.floor(target.createdTimestamp / 1000)}:R>
` +
                   `â€¢ User ID: \`${target.id}\``;

        if (member && member.joinedTimestamp) {
            info += `
â€¢ Joined Server: <t:${Math.floor(member.joinedTimestamp / 1000)}:R>`;
        }

        return interaction.reply(info);
    },

    async choose(interaction) {
        const optionsStr = interaction.options.getString('options');
        const options = optionsStr.split(',').map(s => s.trim()).filter(s => s.length > 0);

        if (options.length < 2) {
            return interaction.reply({ content: 'Please provide at least 2 comma-separated options!', flags: MessageFlags.Ephemeral });
        }

        const picked = options[Math.floor(Math.random() * options.length)];
        return interaction.reply(`ğŸ¯ I choose: **${picked}**`);
    },

    async 8ball(interaction) {
        const question = interaction.options.getString('question');
        const responses = [
            'It is certain.', 'Without a doubt.', 'Yes - definitely.',
            'As I see it, yes.', 'Most likely.', 'Outlook good.',
            'Reply hazy, try again.', 'Ask again later.', 'Better not tell you now.',
            'Don't count on it.', 'My reply is no.', 'Very doubtful.'
        ];

        const answer = responses[Math.floor(Math.random() * responses.length)];
        return interaction.reply(`ğŸ± **Question:** ${question}
**Answer:** ${answer}`);
    },

    async define(interaction) {
        const term = interaction.options.getString('term');
        await interaction.deferReply();

        try {
            const systemPrompt = "You are a concise dictionary assistant. Provide a short, clear definition for the term requested.";
            const reply = await askAI(systemPrompt, `Define the term: ${term}`);
            return interaction.editReply(`ğŸ“– **Definition of "${term}":**
${reply}`);
        } catch (err) {
            return interaction.editReply(`âŒ Failed to fetch definition: ${err.message}`);
        }
    },

    async translate(interaction) {
        const text = interaction.options.getString('text');
        const targetLang = interaction.options.getString('language');
        await interaction.deferReply();

        try {
            const systemPrompt = `You are a direct translator. Translate the given text accurately into ${targetLang}. Return ONLY the translated text without extra formatting or explanation.`;
            const reply = await askAI(systemPrompt, text);
            return interaction.editReply(`ğŸŒ **Translation (${targetLang}):**
${reply}`);
        } catch (err) {
            return interaction.editReply(`âŒ Failed to translate text: ${err.message}`);
        }
    }
};

// ==========================================
// EVENT LISTENERS
// ==========================================

client.once(Events.ClientReady, async () => {
    console.log(`[LOG] Skelerix is online as ${client.user.tag}`);

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        const targetGuildId = process.env.GUILD_ID || client.guilds.cache.first()?.id;
        
        if (targetGuildId) {
            console.log(`[SYNC] Deploying instant commands to Guild: ${targetGuildId}`);
            await rest.put(Routes.applicationGuildCommands(client.user.id, targetGuildId), { body: commandsList });
        }

        console.log('[SYNC] Overwriting global slash commands...');
        await rest.put(Routes.applicationCommands(client.user.id), { body: commandsList });
        console.log('[SYNC] All commands (Server & DM/Group) synced successfully!');
    } catch (err) {
        console.