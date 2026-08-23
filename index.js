require('dotenv').config();

const { Client, GatewayIntentBits, Partials, REST, Routes, SlashCommandBuilder } = require('discord.js');
const Parser = require('rss-parser');

const parser = new Parser();
let lastGUID = null; // Stores last posted RSS item ID to prevent duplicates

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

// Gemini API Integration
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

// RSS Feed Checker Task
async function checkRSSFeed() {
    const feedUrl = process.env.RSS_FEED_URL;
    const channelId = process.env.RSS_CHANNEL_ID;

    if (!feedUrl || !channelId) return;

    try {
        const feed = await parser.parseURL(feedUrl);
        if (!feed.items || feed.items.length === 0) return;

        const latestItem = feed.items[0];
        const itemID = latestItem.guid || latestItem.link || latestItem.title;

        // Skip if this update was already posted
        if (lastGUID === itemID) return;

        // On initial startup, set the baseline without spamming
        if (lastGUID === null) {
            lastGUID = itemID;
            return;
        }

        lastGUID = itemID;

        const channel = await client.channels.fetch(channelId);
        if (channel) {
            const messageContent = `📢 **New Update Posted!**\n\n**${latestItem.title}**\n${latestItem.link}`;
            await channel.send(messageContent);
        }
    } catch (err) {
        console.error('[RSS ERROR] Failed to fetch feed:', err.message);
    }
}

const SERVER_ID = '1536852734374846645';
const commands = [
    new SlashCommandBuilder().setName('sai').setDescription('Ask Skelerix AI a direct question.')
        .addStringOption(o => o.setName('prompt').setDescription('What to ask?').setRequired(true)),
    new SlashCommandBuilder().setName('ping').setDescription('Check Skelerix status and latency.')
].map(c => c.toJSON());

client.once('ready', async () => {
    console.log(`[LOG] Skelerix is online as ${client.user.tag}`);
    
    // Slash commands register
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id, SERVER_ID), { body: commands });
        console.log('[LOG] Commands registered successfully.');
    } catch (err) { 
        console.error('[ERROR] Failed to register commands:', err); 
    }

    // Check RSS feed immediately on boot, then repeat every 10 minutes (600,000 ms)
    checkRSSFeed();
    setInterval(checkRSSFeed, 10 * 60 * 1000);
});

// Chat mentions
client.on('messageCreate', async message => {
    if (message.author.bot || !message.mentions.has(client.user)) return;

    const query = message.content.replace(`<@!${client.user.id}>`, '').replace(`<@${client.user.id}>`, '').trim();
    if (!query) return message.reply({ content: "Yeah? What do you want?", allowedMentions: { repliedUser: true } });

    try {
        await message.channel.sendTyping();
        const fetched = await message.channel.messages.fetch({ limit: 6 });
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
        await interaction.editReply(`Pong! ☠️ Skelerix is active and online! 🌀 
Latency: **${sent.createdTimestamp - interaction.createdTimestamp}ms**`);
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
});

client.login(process.env.DISCORD_TOKEN);
