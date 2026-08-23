require('dotenv').config();

const { Client, GatewayIntentBits, Partials, REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

// Track the latest post ID for each feed separately
const lastGUIDs = {
    TikTok: null,
    YouTube: null
};

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
});

// Skelerix's Personality Instruction
const SYSTEM_INSTRUCTION = "You are Skelerix, a sharp, witty, and cool AI assistant built into the Discord community server. Keep responses brief, clear, and punchy, and remember the context of the ongoing conversation.";

// Gemini API Integration using gemini-3.6-flash
async function askAI(systemPrompt, userPrompt) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }]
        })
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error?.message || `API error: ${response.status}`);
    }
    return data.candidates[0]?.content?.parts[0]?.text || "No response generated.";
}

// Lightweight Native RSS Parser
async function fetchRSS(url) {
    try {
        const response = await fetch(url);
        const text = await response.text();
        
        const titleMatch = text.match(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>/);
        const linkMatch = text.match(/<item>[\s\S]*?<link>([\s\S]*?)<\/link>/);
        
        if (!titleMatch || !linkMatch) return null;
        
        const title = titleMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
        const link = linkMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
        
        return { title, link, id: link };
    } catch (err) {
        return null;
    }
}

// Multi-RSS Checker using Native Fetch
async function checkRSSFeeds() {
    const channelId = process.env.RSS_CHANNEL_ID;
    if (!channelId) return;

    const feeds = [
        { url: 'https://rss.app/feeds/hhxRmx1xY5LYoRFb.xml', name: 'TikTok' },
        { url: 'https://rss.app/feeds/Ijo0kZenkp40O5st.xml', name: 'YouTube' }
    ];

    for (const feedConfig of feeds) {
        try {
            const latestItem = await fetchRSS(feedConfig.url);
            if (!latestItem) continue;

            if (lastGUIDs[feedConfig.name] === latestItem.id) continue;

            if (lastGUIDs[feedConfig.name] === null) {
                lastGUIDs[feedConfig.name] = latestItem.id;
                continue;
            }

            lastGUIDs[feedConfig.name] = latestItem.id;

            const channel = await client.channels.fetch(channelId);
            if (channel) {
                const messageContent = `📢 **New ${feedConfig.name} Update!**\n\n**${latestItem.title}**\n${latestItem.link}`;
                await channel.send(messageContent);
            }
        } catch (err) {
            console.error(`[RSS ERROR - ${feedConfig.name}] Failed to fetch feed:`, err.message);
        }
    }
}

const SERVER_ID = '1536852734374846645';

// Unique Slash Commands Configuration
const commands = [
    new SlashCommandBuilder().setName('sai').setDescription('Ask Skelerix AI a direct question.')
        .addStringOption(o => o.setName('prompt').setDescription('What to ask?').setRequired(true)),
    new SlashCommandBuilder().setName('ping').setDescription('Check Skelerix status and latency.'),
    new SlashCommandBuilder().setName('coinflip').setDescription('Flip a coin! Heads or Tails?'),
    new SlashCommandBuilder().setName('roll').setDescription('Roll a dice.')
        .addIntegerOption(o => o.setName('sides').setDescription('Number of sides (default 6)').setRequired(false)),
    new SlashCommandBuilder().setName('poll').setDescription('Create a quick interactive poll.')
        .addStringOption(o => o.setName('question').setDescription('The poll question').setRequired(true)),
    new SlashCommandBuilder().setName('serverinfo').setDescription('Check out community stats.'),
    new SlashCommandBuilder().setName('timeout').setDescription('Timeout a disruptive user.')
        .addUserOption(o => o.setName('user').setDescription('The user to timeout').setRequired(true))
        .addIntegerOption(o => o.setName('duration').setDescription('Duration in minutes').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
].map(c => c.toJSON());

client.once('clientReady', async () => {
    console.log(`[LOG] Skelerix is online as ${client.user.tag}`);
    
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: [] });
        await rest.put(Routes.applicationCommands(client.user.id, SERVER_ID), { body: commands });
        console.log('[LOG] Commands registered cleanly and duplicates cleared.');
    } catch (err) { 
        console.error('[ERROR] Failed to register commands:', err); 
    }

    checkRSSFeeds();
    setInterval(checkRSSFeeds, 10 * 60 * 1000);
});

client.on('messageCreate', async message => {
    if (message.author.bot || !message.mentions.has(client.user)) return;

    const query = message.content.replace(`<@!${client.user.id}>`, '').replace(`<@${client.user.id}>`, '').trim();
    if (!query) return message.reply({ content: "Yeah? What do you want?", allowedMentions: { repliedUser: true } });

    try {
        await message.channel.sendTyping();
        // Fetching the last 60 messages for deep context tracking
        const fetched = await message.channel.messages.fetch({ limit: 60 });
        const history = Array.from(fetched.values()).reverse().map(m => `${m.author.username}: ${m.content}`).join('\n');
        
        const replyText = await askAI(SYSTEM_INSTRUCTION, `Recent chat:\n${history}\n\nRespond to ${message.author.username}: "${query}"`);
        await message.reply({ content: replyText, allowedMentions: { repliedUser: true } });
    } catch (err) {
        console.error(err);
        await message.reply({ content: `⚠️ Error: \`${err.message}\``, allowedMentions: { repliedUser: true } });
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'ping') {
        const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true });
        const latency = sent.createdTimestamp - interaction.createdTimestamp;
        await interaction.editReply(`Pong! ☠️ Skelerix is active and online! 🌀 \nLatency: **${latency}ms**`);
    }

    if (interaction.commandName === 'sai') {
        const prompt = interaction.options.getString('prompt');
        await interaction.deferReply();
        try {
            const reply = await askAI(SYSTEM_INSTRUCTION, prompt);
            await interaction.editReply(reply);
        } catch (err) {
            await interaction.editReply(`❌ Error: ${err.message}`);
        }
    }

    if (interaction.commandName === 'coinflip') {
        const result = Math.random() < 0.5 ? '🪙 **Heads!**' : '🪙 **Tails!**';
        await interaction.reply(`The coin landed on: ${result}`);
    }

    if (interaction.commandName === 'roll') {
        const sides = interaction.options.getInteger('sides') || 6;
        const roll = Math.floor(Math.random() * sides) + 1;
        await interaction.reply(`🎲 Rolled a d${sides}: **${roll}**`);
    }

    if (interaction.commandName === 'poll') {
        const question = interaction.options.getString('question');
        const pollMessage = await interaction.reply({ 
            content: `📊 **Community Poll:**\n> ${question}\n\n*(Vote using reactions below!)*`, 
            fetchReply: true 
        });
        await pollMessage.react('👍');
        await pollMessage.react('👎');
    }

    if (interaction.commandName === 'serverinfo') {
        const { guild } = interaction;
        await interaction.reply(`🛡️ **${guild.name}** stats:\n👥 Members: **${guild.memberCount}**\n🚀 Boost Level: **Tier ${guild.premiumTier}** (${guild.premiumSubscriptionCount} boosts)`);
    }

    if (interaction.commandName === 'timeout') {
        const targetUser = interaction.options.getMember('user');
        const minutes = interaction.options.getInteger('duration');

        if (!targetUser) {
            return interaction.reply({ content: "❌ User not found in this server.", ephemeral: true });
        }

        try {
            const durationMs = minutes * 60 * 1000;
            await targetUser.timeout(durationMs, `Timed out by ${interaction.user.tag}`);
            await interaction.reply(`🔇 Successfully timed out **${targetUser.user.tag}** for **${minutes} minute(s)**.`);
        } catch (err) {
            await interaction.reply({ content: `❌ Failed to timeout user: ${err.message}`, ephemeral: true });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
