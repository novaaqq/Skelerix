require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    PermissionFlagsBits, 
    Events,
    REST,
    Routes,
    SlashCommandBuilder
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
});

const SYSTEM_INSTRUCTION = "You are Skelerix, a sharp, witty, and cool AI assistant built into the Discord community server. Keep responses brief, clear, and punchy, and remember the context of the ongoing conversation.";

const MUFFLES = [
    "*Mmf!*", 
    "*Mphf mmrgh!*", 
    "*Mmm-mph!*", 
    "*Hmph!*", 
    "*Mmmph...*", 
    "*Muffled angry noises*"
];

const lastGUIDs = { TikTok: null, YouTube: null };
let isTaped = false;

const getRandomMuffle = () => MUFFLES[Math.floor(Math.random() * MUFFLES.length)];

// Slash command definitions
const commandsList = [
    new SlashCommandBuilder()
        .setName('sai')
        .setDescription('Ask Skelerix AI a direct question.')
        .addStringOption(o => o.setName('prompt').setDescription('What to ask?').setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Check Skelerix status, bot latency, and AI response speed.'),
    
    new SlashCommandBuilder()
        .setName('coinflip')
        .setDescription('Flip a coin! Heads or Tails?'),
    
    new SlashCommandBuilder()
        .setName('roll')
        .setDescription('Roll a dice.')
        .addIntegerOption(o => o.setName('sides').setDescription('Number of sides (default 6)').setRequired(false)),
    
    new SlashCommandBuilder()
        .setName('poll')
        .setDescription('Create a quick interactive poll.')
        .addStringOption(o => o.setName('question').setDescription('The poll question').setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription('Check out community stats.'),
    
    new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Timeout a disruptive user.')
        .addUserOption(o => o.setName('user').setDescription('The user to timeout').setRequired(true))
        .addIntegerOption(o => o.setName('duration').setDescription('Duration in minutes').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    
    new SlashCommandBuilder()
        .setName('tape')
        .setDescription("Put tape over Skelerix's mouth (Owner only).")
        .addBooleanOption(o => o.setName('status').setDescription('True to tape, False to remove tape').setRequired(true))
].map(c => c.toJSON());

async function askAI(systemPrompt, userPrompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
    
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }]
        })
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error?.message || `API Error Status: ${response.status}`);
    }

    return data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";
}

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

const commandHandlers = {
    async tape(interaction) {
        if (interaction.user.id !== interaction.guild.ownerId) {
            return interaction.reply({ content: "❌ Only the server owner can tape Skelerix's mouth!", ephemeral: true });
        }

        isTaped = interaction.options.getBoolean('status');
        return interaction.reply(
            isTaped
                ? `📦 **Tape applied!** 🤐 Skelerix's mouth is now covered: *${getRandomMuffle()}*`
                : `✂️ **Tape removed!** Skelerix can speak again.`
        );
    },

    async ping(interaction) {
        const sent = await interaction.reply({ content: 'Pinging bot and AI...', fetchReply: true });
        const botLatency = sent.createdTimestamp - interaction.createdTimestamp;

        let aiLatency = 'N/A';
        try {
            const aiStart = Date.now();
            await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'ping' }] }] })
            });
            aiLatency = `${Date.now() - aiStart}ms`;
        } catch {
            aiLatency = 'Error';
        }

        return interaction.editReply(`Pong! ☠️ Skelerix is active!\n- Bot Latency: **${botLatency}ms**\n- AI Speed: **${aiLatency}**`);
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

    async coinflip(interaction) {
        const outcome = Math.random() < 0.5 ? '🪙 **Heads!**' : '🪙 **Tails!**';
        return interaction.reply(`The coin landed on: ${outcome}`);
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
        const { guild } = interaction;
        return interaction.reply(
            `🛡️ **${guild.name}** stats:\n👥 Members: **${guild.memberCount}**\n🚀 Boost Level: **Tier ${guild.premiumTier}** (${guild.premiumSubscriptionCount} boosts)`
        );
    },

    async timeout(interaction) {
        const targetUser = interaction.options.getMember('user');
        const minutes = interaction.options.getInteger('duration');

        if (!targetUser) return interaction.reply({ content: "❌ User not found.", ephemeral: true });

        try {
            await targetUser.timeout(minutes * 60 * 1000, `Timed out by ${interaction.user.tag}`);
            return interaction.reply(`🔇 Successfully timed out **${targetUser.user.tag}** for **${minutes} minute(s)**.`);
        } catch (err) {
            return interaction.reply({ content: `❌ Failed to timeout user: ${err.message}`, ephemeral: true });
        }
    }
};

client.once(Events.ClientReady, async () => {
    console.log(`[LOG] Skelerix is online as ${client.user.tag}`);

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        // Auto-detect server ID for instant local registration
        const targetGuildId = process.env.GUILD_ID || client.guilds.cache.first()?.id;
        
        if (targetGuildId) {
            console.log(`[SYNC] Deploying instant commands to Guild: ${targetGuildId}`);
            await rest.put(Routes.applicationGuildCommands(client.user.id, targetGuildId), { body: commandsList });
        }

        console.log('[SYNC] Overwriting global slash commands...');
        await rest.put(Routes.applicationCommands(client.user.id), { body: commandsList });
        console.log('[SYNC] All commands synced successfully!');
    } catch (err) {
        console.error('[SYNC ERROR]:', err);
    }

    await checkRSSFeeds();
    setInterval(checkRSSFeeds, 10 * 60 * 1000);
});

client.on(Events.MessageCreate, async message => {
    if (message.author.bot || !message.mentions.has(client.user)) return;

    if (isTaped) {
        return message.reply({ 
            content: `📦 **${getRandomMuffle()}** *(Skelerix's mouth is taped shut!)*`, 
            allowedMentions: { repliedUser: true } 
        });
    }

    const query = message.content.replace(/<@!?\d+>/g, '').trim();
    if (!query) {
        return message.reply({ content: "Yeah? What do you want?", allowedMentions: { repliedUser: true } });
    }

    try {
        await message.channel.sendTyping();
        const fetched = await message.channel.messages.fetch({ limit: 60 });
        const history = Array.from(fetched.values())
            .reverse()
            .map(m => `${m.author.username}: ${m.content}`)
            .join('\n');
        
        const promptContext = `Recent chat:\n${history}\n\nRespond to ${message.author.username}: "${query}"`;
        const replyText = await askAI(SYSTEM_INSTRUCTION, promptContext);
        
        const safeReply = replyText.length > 2000 ? `${replyText.slice(0, 1997)}...` : replyText;
        await message.reply({ content: safeReply, allowedMentions: { repliedUser: true } });
    } catch (err) {
        await message.reply({ content: `⚠️ Error: \`${err.message}\``, allowedMentions: { repliedUser: true } });
    }
});

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const handler = commandHandlers[interaction.commandName];
    if (!handler) return;

    if (interaction.commandName === 'tape') {
        return handler(interaction);
    }

    if (isTaped) {
        return interaction.reply({ 
            content: `📦 **${getRandomMuffle()}** *(Skelerix is taped up and can't use commands right now!)*`, 
            ephemeral: true 
        });
    }

    try {
        await handler(interaction);
    } catch (err) {
        console.error(`[COMMAND ERROR] ${interaction.commandName}:`, err);
        const errorMsg = { content: '❌ An error occurred while executing this command.', ephemeral: true };
        if (interaction.deferred || interaction.replied) {
            await interaction.followUp(errorMsg);
        } else {
            await interaction.reply(errorMsg);
        }
    }
});

process.on('unhandledRejection', error => console.error('[UNHANDLED REJECTION]:', error));

client.login(process.env.DISCORD_TOKEN);
