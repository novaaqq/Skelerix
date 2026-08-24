require('dotenv').config();

const { Client, GatewayIntentBits, Partials, REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const lastGUIDs = { TikTok: null, YouTube: null };
let isTaped = false; // Tracks if Skelerix's mouth is taped

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
    partials: [Partials.Channel]
});

const SYSTEM_INSTRUCTION = "You are Skelerix, a sharp, witty, and cool AI assistant built into the Discord community server. Keep responses brief, clear, and punchy, and remember the context of the ongoing conversation.";

const MUFFLES = ["*Mmf!*", "*Mphf mmrgh!*", "*Mmm-mph!*", "*Hmph!*", "*Mmmph...*", "*Muffled angry noises*"];
function getRandomMuffle() {
    return MUFFLES[Math.floor(Math.random() * MUFFLES.length)];
}

// Fast Gemini API Handler using direct fetch
async function askAI(systemPrompt, userPrompt) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }]
        })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || `API error: ${res.status}`);
    return data.candidates[0]?.content?.parts[0]?.text || "No response generated.";
}

// Lightweight Native RSS Parser
async function fetchRSS(url) {
    try {
        const res = await fetch(url);
        const text = await res.text();
        const title = text.match(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
        const link = text.match(/<item>[\s\S]*?<link>([\s\S]*?)<\/link>/)?.[1]?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
        return title && link ? { title, link, id: link } : null;
    } catch {
        return null;
    }
}

async function checkRSSFeeds() {
    const channelId = process.env.RSS_CHANNEL_ID;
    if (!channelId) return;

    const feeds = [
        { url: 'https://rss.app/feeds/hhxRmx1xY5LYoRFb.xml', name: 'TikTok' },
        { url: 'https://rss.app/feeds/Ijo0kZenkp40O5st.xml', name: 'YouTube' }
    ];

    for (const f of feeds) {
        const item = await fetchRSS(f.url);
        if (!item || lastGUIDs[f.name] === item.id) continue;
        
        if (lastGUIDs[f.name] === null) {
            lastGUIDs[f.name] = item.id;
            continue;
        }
        lastGUIDs[f.name] = item.id;

        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (channel) await channel.send(`📢 **New ${f.name} Update!**\n\n**${item.title}**\n${item.link}`);
    }
}

const SERVER_ID = '1536852734374846645';

const commands = [
    new SlashCommandBuilder().setName('sai').setDescription('Ask Skelerix AI a direct question.')
        .addStringOption(o => o.setName('prompt').setDescription('What to ask?').setRequired(true)),
    new SlashCommandBuilder().setName('ping').setDescription('Check Skelerix status, bot latency, and AI response speed.'),
    new SlashCommandBuilder().setName('coinflip').setDescription('Flip a coin! Heads or Tails?'),
    new SlashCommandBuilder().setName('roll').setDescription('Roll a dice.')
        .addIntegerOption(o => o.setName('sides').setDescription('Number of sides (default 6)').setRequired(false)),
    new SlashCommandBuilder().setName('poll').setDescription('Create a quick interactive poll.')
        .addStringOption(o => o.setName('question').setDescription('The poll question').setRequired(true)),
    new SlashCommandBuilder().setName('serverinfo').setDescription('Check out community stats.'),
    new SlashCommandBuilder().setName('timeout').setDescription('Timeout a disruptive user.')
        .addUserOption(o => o.setName('user').setDescription('The user to timeout').setRequired(true))
        .addIntegerOption(o => o.setName('duration').setDescription('Duration in minutes').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    new SlashCommandBuilder().setName('tape').setDescription('Put tape over Skelerix\'s mouth (Owner only).')
        .addBooleanOption(o => o.setName('status').setDescription('True to tape, False to remove tape').setRequired(true))
].map(c => c.toJSON());

client.once('clientReady', async () => {
    console.log(`[LOG] Skelerix is online as ${client.user.tag}`);
    
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: [] });
        await rest.put(Routes.applicationCommands(client.user.id, SERVER_ID), { body: commands });
        console.log('[LOG] Commands registered cleanly.');
    } catch (err) { 
        console.error('[ERROR] Command registration failed:', err); 
    }

    checkRSSFeeds();
    setInterval(checkRSSFeeds, 10 * 60 * 1000);
});

client.on('messageCreate', async message => {
    if (message.author.bot || !message.mentions.has(client.user)) return;

    if (isTaped) {
        return message.reply({ content: `📦 **${getRandomMuffle()}** *(Skelerix's mouth is taped shut!)*`, allowedMentions: { repliedUser: true } });
    }

    const query = message.content.replace(/<@!?\d+>/g, '').trim();
    if (!query) return message.reply({ content: "Yeah? What do you want?", allowedMentions: { repliedUser: true } });

    try {
        await message.channel.sendTyping();
        const fetched = await message.channel.messages.fetch({ limit: 60 });
        const history = Array.from(fetched.values()).reverse().map(m => `${m.author.username}: ${m.content}`).join('\n');
        
        const replyText = await askAI(SYSTEM_INSTRUCTION, `Recent chat:\n${history}\n\nRespond to ${message.author.username}: "${query}"`);
        await message.reply({ content: replyText, allowedMentions: { repliedUser: true } });
    } catch (err) {
        await message.reply({ content: `⚠️ Error: \`${err.message}\``, allowedMentions: { repliedUser: true } });
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'tape') {
        // Check if user is the server owner
        if (interaction.user.id !== interaction.guild.ownerId) {
            return interaction.reply({ content: "❌ Only the server owner can tape Skelerix's mouth!", ephemeral: true });
        }

        isTaped = interaction.options.getBoolean('status');
        if (isTaped) {
            await interaction.reply(`📦 **Tape applied!** 🤐 Skelerix's mouth is now covered: *${getRandomMuffle()}*`);
        } else {
            await interaction.reply(`✂️ **Tape removed!** Skelerix can speak again.`);
        }
        return;
    }

    if (isTaped) {
        return interaction.reply({ content: `📦 **${getRandomMuffle()}** *(Skelerix is taped up and can't use commands right now!)*`, ephemeral: true });
    }

    if (interaction.commandName === 'ping') {
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

        await interaction.editReply(`Pong! ☠️ Skelerix is active! 🌀\n- Bot Latency: **${botLatency}ms**\n- AI Speed: **${aiLatency}**`);
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
        await interaction.reply(`The coin landed on: ${Math.random() < 0.5 ? '🪙 **Heads!**' : '🪙 **Tails!**'}`);
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

        if (!targetUser) return interaction.reply({ content: "❌ User not found.", ephemeral: true });

        try {
            await targetUser.timeout(minutes * 60 * 1000, `Timed out by ${interaction.user.tag}`);
            await interaction.reply(`🔇 Successfully timed out **${targetUser.user.tag}** for **${minutes} minute(s)**.`);
        } catch (err) {
            await interaction.reply({ content: `❌ Failed to timeout user: ${err.message}`, ephemeral: true });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
