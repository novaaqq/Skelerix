require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    PermissionFlagsBits, 
    Events,
    REST,
    Routes,
    SlashCommandBuilder,
    ApplicationIntegrationType,
    InteractionContextType,
    ChannelType,
    MessageFlags
} = require('discord.js');
const Groq = require('groq-sdk');

// ==========================================
// CONFIG & BOT INITIALIZATION
// ==========================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
});

// Initialize Groq Client
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Casual, sharp, witty, and fun system instruction
const SYSTEM_INSTRUCTION = "You are Skelerix, a casual, sharp, and quick-witted AI assistant. Talk naturally, like a laid-back group chat member. Keep responses concise, playful, and clever. Avoid robotic formality and mean roasts—just keep it cool, helpful, and funny.";

const MUFFLES = [
    "*Mmf!*", 
    "*Mphf mmrgh!*", 
    "*Mmm-mph!*", 
    "*Hmph!*", 
    "*Mmmph...*", 
    "*Muffled noises*"
];

const EIGHT_BALL_RESPONSES = [
    "It is certain.", "It is decidedly so.", "Without a doubt.", "Yes definitely.",
    "You may rely on it.", "As I see it, yes.", "Most likely.", "Outlook good.",
    "Yes.", "Signs point to yes.", "Reply hazy, try again.", "Ask again later.",
    "Better not tell you now.", "Cannot predict now.", "Concentrate and ask again.",
    "Don't count on it.", "My reply is no.", "My sources say no.",
    "Outlook not so good.", "Very doubtful."
];

const lastGUIDs = { TikTok: null, YouTube: null };
let isTaped = false;

const getRandomMuffle = () => MUFFLES[Math.floor(Math.random() * MUFFLES.length)];

// Configures commands to work in Servers, Bot DMs, and Group DMs
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
                 .setDescription('The update logs / patch notes (Use \\n for new lines)')
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
    // NEW COMMANDS
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
            .addStringOption(o => o.setName('options').setDescription('Options separated by commas (e.g. Red, Blue, Green)').setRequired(true))
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
            .addStringOption(o => o.setName('language').setDescription('Target language (e.g., English, Turkish, Spanish)').setRequired(true))
    )
].map(c => c.toJSON());

// ==========================================
// GROQ AI INTEGRATION
// ==========================================
async function askAI(systemPrompt, userPrompt) {
    const completion = await groq.chat.completions.create({
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        model: 'llama-3.3-70b-versatile',
    });

    return completion.choices[0]?.message?.content || "No response generated.";
}

// ==========================================
// RSS FEED SYSTEM
// ==========================================
async function fetchRSS(url) {
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        
        const text = await res.text();
        const titleMatch = text.match(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>/);
        const linkMatch = text.match(/<item>[\s\S]*?<link>([\s\S]*?)<\/link>/);

        if (!titleMatch || !linkMatch) return null;

        const title = titleMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
        const link = linkMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();

        return { title, link, id: link };
    } catch (err) {
        console.error('[RSS FETCH ERROR]:', err.message);
        return null;
    }
}

async function checkRSSFeeds() {
    const channelId = process.env.RSS_CHANNEL_ID;
    if (!channelId) return;

    const feeds = [
        { url: process.env.TIKTOK_RSS_URL, name: 'TikTok' },
        { url: process.env.YOUTUBE_RSS_URL, name: 'YouTube' }
    ].filter(feed => feed.url);

    for (const feed of feeds) {
        const item = await fetchRSS(feed.url);
        if (!item || lastGUIDs[feed.name] === item.id) continue;

        if (lastGUIDs[feed.name] === null) {
            lastGUIDs[feed.name] = item.id;
            continue;
        }

        lastGUIDs[feed.name] = item.id;

        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (channel?.isTextBased()) {
            await channel.send(`📢 **New ${feed.name} Update!**\n\n**${item.title}**\n${item.link}`).catch(console.error);
        }
    }
}

// ==========================================
// COMMAND HANDLERS ROUTING MAP
// ==========================================
const commandHandlers = {
    async tape(interaction) {
        if (interaction.guild && interaction.user.id !== interaction.guild.ownerId) {
            return interaction.reply({ content: "Only the server owner can tape my mouth shut.", flags: MessageFlags.Ephemeral });
        }

        isTaped = interaction.options.getBoolean('status');
        return interaction.reply(
            isTaped
                ? `📦 **Tape applied!** 🤐 *${getRandomMuffle()}*`
                : `✂️ **Tape removed!** Back in business.`
        );
    },

    async ping(interaction) {
        const sent = await interaction.reply({ content: 'Checking latency...', fetchReply: true });
        const botLatency = sent.createdTimestamp - interaction.createdTimestamp;

        let aiLatency = 'N/A';
        try {
            const aiStart = Date.now();
            await groq.chat.completions.create({
                messages: [{ role: 'user', content: 'ping' }],
                model: 'llama-3.3-70b-versatile',
            });
            aiLatency = `${Date.now() - aiStart}ms`;
        } catch {
            aiLatency = 'Error';
        }

        return interaction.editReply(`☠️ Skelerix is active and online! 🌀\n• latency: ${botLatency}ms\n• AI speed: ${aiLatency}`);
    },

    async update(interaction) {
        await interaction.deferReply();
        try {
            await checkRSSFeeds();
            return interaction.editReply("🔄 **Checked for new TikTok and YouTube updates!**");
        } catch (err) {
            return interaction.editReply(`❌ Failed to check updates: ${err.message}`);
        }
    },

    async gameupd(interaction) {
        const targetChannel = interaction.options.getChannel('channel');
        const gameName = interaction.options.getString('game');
        const version = interaction.options.getString('version');
        const logsRaw = interaction.options.getString('logs');

        const formattedLogs = logsRaw.replace(/\\n/g, '\n');

        const announcement = 
            `🎮 **${gameName} Update Release!**\n` +
            `*Official Patch Notes*\n\n` +
            `📌 **Version:** \`${version}\`\n\n` +
            `📋 **What's New:**\n` +
            `${formattedLogs}\n\n` +
            `─────────────\n` +
            `*Posted by ${interaction.user.tag}*`;

        try {
            await targetChannel.send(announcement);
            return interaction.reply({ 
                content: `✅ Update announcement for **${gameName}** (\`${version}\`) sent successfully to ${targetChannel}!`, 
                flags: MessageFlags.Ephemeral 
            });
        } catch (err) {
            return interaction.reply({ 
                content: `❌ Could not send message to ${targetChannel}:${err.message}`, 
                flags: MessageFlags.Ephemeral 
            });
        }
    },

    async sai(interaction) {
        const prompt = interaction.options.getString('prompt');
        await interaction.deferReply();
        try {
            const reply = await askAI(SYSTEM_INSTRUCTION, prompt);
            return interaction.editReply(reply.length > 2000 ? `${reply.slice(0, 1997)}...` : reply);
        } catch (err) {
            return interaction.editReply(`❌ Error: ${err.message}`);
        }
    },

    async saireset(interaction) {
        return interaction.reply("🧹 **Memory wiped!** I've forgotten recent conversation context for this channel.");
    },

    async coinflip(interaction) {
        const outcome = Math.random() < 0.5 ? '🪙 **Heads!**' : '🪙 **Tails!**';
        return interaction.reply(`It landed on: ${outcome}`);
    },

    async roll(interaction) {
        const sides = interaction.options.getInteger('sides') || 6;
        const roll = Math.floor(Math.random() * sides) + 1;
        return interaction.reply(`🎲 Rolled a d${sides}: **${roll}**`);
    },

    async poll(interaction) {
        const question = interaction.options.getString('question');
        const pollMessage = await interaction.reply({ 
            content: `📊 **Community Poll:**\n> ${question}\n\n*(Vote using reactions below!)*`, 
            fetchReply: true 
        });
        await pollMessage.react('👍');
        await pollMessage.react('👎');
    },

    async serverinfo(interaction) {
        if (!interaction.guild) {
            return interaction.reply({ content: "Run this command inside a server to see stats.", flags: MessageFlags.Ephemeral });
        }
        const { guild } = interaction;
        return interaction.reply(
            `🛡️ **${guild.name}** stats:\n👥 Members: **${guild.memberCount}**\n🚀 Boost Level: **Tier ${guild.premiumTier}** (${guild.premiumSubscriptionCount} boosts)`
        );
    },

    async timeout(interaction) {
        if (!interaction.guild) {
            return interaction.reply({ content: "Can't timeout users outside of a server.", flags: MessageFlags.Ephemeral });
        }
        const targetUser = interaction.options.getMember('user');
        const minutes = interaction.options.getInteger('duration');

        if (!targetUser) return interaction.reply({ content: "User not found.", flags: MessageFlags.Ephemeral });

        try {
            await targetUser.timeout(minutes * 60 * 1000, `Timed out by ${interaction.user.tag}`);
            return interaction.reply(`🔇 **${targetUser.user.tag}** timed out for **${minutes} minute(s)**.`);
        } catch (err) {
            return interaction.reply({ content: `❌ Couldn't timeout user: ${err.message}`, flags: MessageFlags.Ephemeral });
        }
    },

    // NEW COMMAND HANDLERS
    async remind(interaction) {
        const minutes = interaction.options.getInteger('minutes');
        const task = interaction.options.getString('task');

        if (minutes <= 0) {
            return interaction.reply({ content: "❌ Minutes must be greater than 0.", flags: MessageFlags.Ephemeral });
        }

        await interaction.reply(`⏰ Reminder set! I'll ping you in **${minutes} minute(s)** for: "${task}"`);

        setTimeout(async () => {
            const reminderMsg = `🔔 <@${interaction.user.id}> **Reminder:**${task}`;
            if (interaction.channel) {
                await interaction.channel.send(reminderMsg).catch(() => null);
            } else {
                await interaction.user.send(reminderMsg).catch(() => null);
            }
        }, minutes * 60 * 1000);
    },

    async stats(interaction) {
        const uptimeSeconds = Math.floor(process.uptime());
        const days = Math.floor(uptimeSeconds / 86400);
        const hours = Math.floor((uptimeSeconds % 86400) / 3600);
        const mins = Math.floor((uptimeSeconds % 3600) / 60);
        const secs = uptimeSeconds % 60;

        const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
        const totalServers = client.guilds.cache.size;

        return interaction.reply(
            `📊 **Skelerix Bot Statistics**\n` +
            `• **Uptime:** ${days}d${hours}h ${mins}m${secs}s\n` +
            `• **Memory Usage:** ${memoryUsage} MB\n` +
            `• **Servers:** ${totalServers}\n` +
            `• **WebSocket Latency:** ${client.ws.ping}ms`
        );
    },

    async userinfo(interaction) {
        const user = interaction.options.getUser('target') || interaction.user;
        const member = interaction.guild?.members.cache.get(user.id);

        const joinedServer = member ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'N/A';
        const createdAccount = `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`;

        return interaction.reply(
            `👤 **User Information for ${user.tag}**\n` +
            `• **User ID:** \`${user.id}\`\n` +
            `• **Account Created:** ${createdAccount}\n` +
            `• **Joined Server:** ${joinedServer}\n` +
            `• **Bot:** ${user.bot ? 'Yes' : 'No'}`
        );
    },

    async choose(interaction) {
        const optionsRaw = interaction.options.getString('options');
        const choices = optionsRaw.split(',').map(c => c.trim()).filter(c => c.length > 0);

        if (choices.length < 2) {
            return interaction.reply({ content: "❌ Please provide at least two options separated by commas.", flags: MessageFlags.Ephemeral });
        }

        const picked = choices[Math.floor(Math.random() * choices.length)];
        return interaction.reply(`🎯 Out of choices [${choices.join(', ')}], I pick: **${picked}**`);
    },

    async ['8ball'](interaction) {
        const question = interaction.options.getString('question');
        const answer = EIGHT_BALL_RESPONSES[Math.floor(Math.random() * EIGHT_BALL_RESPONSES.length)];
        return interaction.reply(`🔮 **Question:** ${question}\n🎱 **8-Ball Says:** ${answer}`);
    },

    async define(interaction) {
        const term = interaction.options.getString('term');
        await interaction.deferReply();

        try {
            const systemPrompt = "You are a concise dictionary assistant. Define the given word/phrase directly and clearly. Provide a short definition and an example sentence.";
            const reply = await askAI(systemPrompt, `Define: ${term}`);
            return interaction.editReply(`📖 **Definition for "${term}":**\n${reply}`);
        } catch (err) {
            return interaction.editReply(`❌ Failed to define term: ${err.message}`);
        }
    },

    async translate(interaction) {
        const text = interaction.options.getString('text');
        const targetLang = interaction.options.getString('language');
        await interaction.deferReply();

        try {
            const systemPrompt = `You a