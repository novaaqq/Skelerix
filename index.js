const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField, REST, Routes, SlashCommandBuilder } = require('discord.js');
const Parser = require('rss-parser');
const http = require('http');
const Groq = require('groq-sdk');

// Web server for Render health check
http.createServer((req, res) => {
    res.write("Skelerix is online and operational!");
    res.end();
}).listen(process.env.PORT || 3000);

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent
    ] 
});

const parser = new Parser();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// --- CONFIGURATION ---
const YOUTUBE_ANNOUNCEMENT_CHANNEL_ID = '1536854741756284958';
const GAME_UPDATE_CHANNEL_ID = '1536854230239805605';
const YOUTUBE_CHANNEL_ID = 'UCcX_U3PVmP7KTiIhqJ9_8kg';
const BRAND_COLOR = 0x0099FF;

let lastVideoId = '';
const channelMemories = new Map();

// --- DEFINE GLOBAL SLASH COMMANDS ---
const commands = [
    new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Check if Skelerix is online')
        .setIntegrationTypes([0, 1])
        .setContexts([0, 1, 2]),

    new SlashCommandBuilder()
        .setName('sai')
        .setDescription('Ask Skelerix AI a question')
        .addStringOption(option => 
            option.setName('question')
                .setDescription('The question you want to ask')
                .setRequired(true))
        .setIntegrationTypes([0, 1])
        .setContexts([0, 1, 2]),

    new SlashCommandBuilder()
        .setName('forget')
        .setDescription('Clear Skelerix AI memory for this channel')
        .setIntegrationTypes([0, 1])
        .setContexts([0, 1, 2]),

    new SlashCommandBuilder()
        .setName('update')
        .setDescription('Post a new game update announcement (Server Only)')
        .addStringOption(opt => opt.setName('version').setDescription('Version tag').setRequired(true))
        .addStringOption(opt => opt.setName('title').setDescription('Update title').setRequired(true))
        .addStringOption(opt => opt.setName('changelog').setDescription('Update details').setRequired(true))
        .setIntegrationTypes([0])
        .setContexts([0]),

    new SlashCommandBuilder()
        .setName('lockdown')
        .setDescription('Lock down text channels (Server Only)')
        .setIntegrationTypes([0])
        .setContexts([0]),

    new SlashCommandBuilder()
        .setName('unlock')
        .setDescription('Unlock text channels (Server Only)')
        .setIntegrationTypes([0])
        .setContexts([0])
].map(cmd => cmd.toJSON());

// --- REGISTER GLOBAL SLASH COMMANDS ---
client.once('ready', async () => {
    console.log(`Skelerix is online as ${client.user.tag}!`);

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        console.log('Registering Global Slash Commands...');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        console.log('Successfully registered Global Slash Commands!');
    } catch (error) {
        console.error('Error registering slash commands:', error);
    }

    checkYouTube();
    setInterval(checkYouTube, 10 * 1000);
});

// --- YOUTUBE ANNOUNCEMENTS ---
async function checkYouTube() {
    try {
        const feed = await parser.parseURL(`https://www.youtube.com/feeds/videos.xml?channel_id=${YOUTUBE_CHANNEL_ID}`);
        if (!feed.items || feed.items.length === 0) return;

        const latestVideo = feed.items[0];
        const videoId = latestVideo.id.split(':')[2];

        if (lastVideoId === '') {
            lastVideoId = videoId;
            return;
        }

        if (lastVideoId !== videoId) {
            lastVideoId = videoId;

            const channel = await client.channels.fetch(YOUTUBE_ANNOUNCEMENT_CHANNEL_ID);
            if (!channel) return;

            const embed = new EmbedBuilder()
                .setTitle(latestVideo.title)
                .setURL(latestVideo.link)
                .setColor(0xFF0000)
                .setAuthor({ 
                    name: 'Skelerix Broadcast • New YouTube Upload!', 
                    iconURL: client.user.displayAvatarURL() 
                })
                .setImage(`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`)
                .setFooter({ text: 'Skelerix Automated Notifications' })
                .setTimestamp(new Date(latestVideo.pubDate));

            await channel.send({ 
                content: '🚨 **New Video Alert!** Check out the latest upload below:', 
                embeds: [embed] 
            });
        }
    } catch (error) {
        console.error('Skelerix YouTube Check Error:', error);
    }
}

// --- SLASH COMMAND & MESSAGE HANDLER ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options, guild, channel, member, user } = interaction;
    const channelId = channel ? channel.id : user.id;

    // /ping command handler
    if (commandName === 'ping') {
        return interaction.reply('💀 **Skelerix is active and online!** 🌀');
    }

    // /forget
    if (commandName === 'forget') {
        channelMemories.delete(channelId);
        return interaction.reply('🧠 **Skelerix memory cleared for this channel!**');
    }

    // /sai [question]
    if (commandName === 'sai') {
        const prompt = options.getString('question');

        try {
            await interaction.deferReply();

            if (!channelMemories.has(channelId)) {
                channelMemories.set(channelId, [
                    {
                        role: 'system',
                        content: 'You are Skelerix, an intelligent and helpful assistant. Keep answers concise and direct for chat.'
                    }
                ]);
            }

            const history = channelMemories.get(channelId);
            history.push({ role: 'user', content: `${user.username}: ${prompt}` });

            const completion = await groq.chat.completions.create({
                messages: history,
                model: 'llama-3.3-70b-versatile'
            });

            const reply = completion.choices[0]?.message?.content || 'I could not process that request.';
            history.push({ role: 'assistant', content: reply });

            if (history.length > 61) {
                history.splice(1, 2);
            }

            if (reply.length > 2000) {
                await interaction.editReply(reply.slice(0, 1995) + '...');
            } else {
                await interaction.editReply(reply);
            }
        } catch (error) {
            console.error('Groq AI Error:', error);
            if (interaction.deferred) {
                await interaction.editReply('❌ Skelerix hit a snag while processing that query.');
            } else {
                await interaction.reply('❌ Skelerix hit a snag while processing that query.');
            }
        }
    }

    // /update
    if (commandName === 'update') {
        const version = options.getString('version');
        const title = options.getString('title');
        const changelog = options.getString('changelog');

        const targetChannel = await client.channels.fetch(GAME_UPDATE_CHANNEL_ID);
        if (!targetChannel) return interaction.reply({ content: '❌ Game update channel not found.', ephemeral: true });

        const embed = new EmbedBuilder()
            .setTitle(`🎮 Game Update [${version}]: ${title}`)
            .setDescription(changelog)
            .setColor(BRAND_COLOR)
            .setAuthor({ 
                name: 'Skelerix Dev Dispatch', 
                iconURL: client.user.displayAvatarURL() 
            })
            .setFooter({ text: 'Skelerix Game Announcements' })
            .setTimestamp();

        await targetChannel.send({ 
            content: '📢 **A new game update has landed!**', 
            embeds: [embed] 
        });

        return interaction.reply({ content: `✅ Game update posted to <#${GAME_UPDATE_CHANNEL_ID}>!`, ephemeral: true });
    }

    // /lockdown
    if (commandName === 'lockdown') {
        if (!member || !member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
            return interaction.reply({ content: '❌ You need `Manage Channels` permission.', ephemeral: true });
        }

        const channels = guild.channels.cache.filter(c => c.isTextBased());
        const everyoneRole = guild.roles.everyone;

        for (const [id, ch] of channels) {
            try {
                await ch.permissionOverwrites.edit(everyoneRole, { SendMessages: false });
            } catch (err) {
                console.error(`Error locking ${ch.name}:`, err);
            }
        }

        return interaction.reply('Server has been locked down!(✿◠‿◠)');
    }

    // /unlock
    if (commandName === 'unlock') {
        if (!member || !member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
            return interaction.reply({ content: '❌ You need `Manage Channels` permission.', ephemeral: true });
        }

        const channels = guild.channels.cache.filter(c => c.isTextBased());
        const everyoneRole = guild.roles.everyone;

        for (const [id, ch] of channels) {
            try {
                await ch.permissionOverwrites.edit(everyoneRole, { SendMessages: null });
            } catch (err) {
                console.error(`Error unlocking ${ch.name}:`, err);
            }
        }

        return interaction.reply('Server has been unlocked!(✿◠‿◠)');
    }
});

// Listener for text-based >ping command
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.content.trim() === '>ping' || message.content.trim() === '> ping') {
        return message.reply('💀 **Skelerix is active and online!** 🌀');
    }
});

client.login(process.env.DISCORD_TOKEN);
