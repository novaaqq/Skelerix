const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    PermissionsBitField, 
    REST, 
    Routes, 
    SlashCommandBuilder,
    ApplicationIntegrationType,
    InteractionContextType
} = require('discord.js');
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

// --- DEFINE GLOBAL SLASH COMMANDS (USER-INSTALLABLE) ---
const commands = [
    new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Check if Skelerix is online')
        .setIntegrationTypes([
            ApplicationIntegrationType.GuildInstall, 
            ApplicationIntegrationType.UserInstall
        ])
        .setContextTypes([
            InteractionContextType.Guild, 
            InteractionContextType.BotDM, 
            InteractionContextType.PrivateChannel
        ]),

    new SlashCommandBuilder()
        .setName('sai')
        .setDescription('Ask Skelerix AI a question')
        .addStringOption(option => 
            option.setName('question')
                .setDescription('The question you want to ask')
                .setRequired(true))
        .setIntegrationTypes([
            ApplicationIntegrationType.GuildInstall, 
            ApplicationIntegrationType.UserInstall
        ])
        .setContextTypes([
            InteractionContextType.Guild, 
            InteractionContextType.BotDM, 
            InteractionContextType.PrivateChannel
        ]),

    new SlashCommandBuilder()
        .setName('forget')
        .setDescription('Clear Skelerix AI memory for this channel')
        .setIntegrationTypes([
            ApplicationIntegrationType.GuildInstall, 
            ApplicationIntegrationType.UserInstall
        ])
        .setContextTypes([
            InteractionContextType.Guild, 
            InteractionContextType.BotDM, 
            InteractionContextType.PrivateChannel
        ]),

    new SlashCommandBuilder()
        .setName('update')
        .setDescription('Post a new game update announcement (Server Only)')
        .addStringOption(opt => opt.setName('version').setDescription('Version tag').setRequired(true))
        .addStringOption(opt => opt.setName('title').setDescription('Update title').setRequired(true))
        .addStringOption(opt => opt.setName('changelog').setDescription('Update details').setRequired(true))
        .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
        .setContextTypes([InteractionContextType.Guild]),

    new SlashCommandBuilder()
        .setName('lockdown')
        .setDescription('Lock down text channels (Server Only)')
        .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
        .setContextTypes([InteractionContextType.Guild]),

    new SlashCommandBuilder()
        .setName('unlock')
        .setDescription('Unlock text channels (Server Only)')
        .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
        .setContextTypes([InteractionContextType.Guild])
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

// --- SLASH COMMAND HANDLER ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options, guild, channel, member, user } = interaction;
    const channelId = channel ? channel.id : user.id;

    // /ping
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

client.login(process.env.DISCORD_TOKEN);
try {
            await message.channel.sendTyping();

            if (!channelMemories.has(message.channel.id)) {
                channelMemories.set(message.channel.id, [
                    {
                        role: 'system',
                        content: 'You are Skelerix, an intelligent and helpful Discord server bot assistant. You have memory of the preceding conversation in this channel. Keep answers concise, clear, and direct for Discord chat.'
                    }
                ]);
            }

            const history = channelMemories.get(message.channel.id);
            history.push({ role: 'user', content: `${message.author.username}: ${prompt}` });

            const completion = await groq.chat.completions.create({
                messages: history,
                model: 'llama-3.3-70b-versatile'
            });

            const reply = completion.choices[0]?.message?.content || 'I could not process that request.';
            history.push({ role: 'assistant', content: reply });

            // Keep memory capped at 60 messages (plus system prompt)
            if (history.length > 61) {
                history.splice(1, 2);
            }

            if (reply.length > 2000) {
                message.reply(reply.slice(0, 1995) + '...');
            } else {
                message.reply(reply);
            }
        } catch (error) {
            console.error('Groq AI Error:', error);
            message.reply('❌ Skelerix hit a snag while processing that query. Check server logs.');
        }
    }

    // >update Version | Title | Changelog
    if (message.content.startsWith(`${PREFIX}update `)) {
        const args = message.content.slice(PREFIX.length + 7).split('|');
        if (args.length < 3) {
            return message.reply(`❌ **Format:** \`${PREFIX}update Version | Title | Changelog\``);
        }

        const version = args[0].trim();
        const title = args[1].trim();
        const changelog = args[2].trim();

        const channel = await client.channels.fetch(GAME_UPDATE_CHANNEL_ID);
        if (!channel) return message.reply('❌ Game update channel not found.');

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

        await channel.send({ 
            content: '📢 **A new game update has landed!**', 
            embeds: [embed] 
        });

        message.reply(`✅ Game update posted to <#${GAME_UPDATE_CHANNEL_ID}> by Skelerix!`);
    }

    // >lockdown or >lock
    if (message.content === `${PREFIX}lockdown` || message.content === `${PREFIX}lock`) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
            return message.reply('❌ You need the `Manage Channels` permission to lock down.');
        }

        const channels = message.guild.channels.cache.filter(c => c.isTextBased());
        const everyoneRole = message.guild.roles.everyone;

        for (const [id, channel] of channels) {
            try {
                await channel.permissionOverwrites.edit(everyoneRole, { SendMessages: false });
            } catch (err) {
                console.error(`Error locking ${channel.name}:`, err);
            }
        }

        message.channel.send('Server has been locked down!(✿◠‿◠)');
    }

    // >unlock
    if (message.content === `${PREFIX}unlock`) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
            return message.reply('❌ You need the `Manage Channels` permission to unlock.');
        }

        const channels = message.guild.channels.cache.filter(c => c.isTextBased());
        const everyoneRole = message.guild.roles.everyone;

        for (const [id, channel] of channels) {
            try {
                await channel.permissionOverwrites.edit(everyoneRole, { SendMessages: null });
            } catch (err) {
                console.error(`Error unlocking ${channel.name}:`, err);
            }
        }

        message.channel.send('Server has been unlocked!(✿◠‿◠)');
    }
});

client.login(process.env.DISCORD_TOKEN);
}

    // AI Ask Command with Memory: >ask [question]
    if (message.content.startsWith(`${PREFIX}ask `)) {
        const prompt = message.content.slice(PREFIX.length + 4).trim();
        if (!prompt) return message.reply('❌ Please provide a question! Example: `>ask Hi, my name is Rob`');

        try {
            await message.channel.sendTyping();

            // Retrieve or initialize conversation memory for this channel
            if (!channelMemories.has(message.channel.id)) {
                channelMemories.set(message.channel.id, [
                    {
                        role: 'system',
                        content: 'You are Skelerix, an intelligent and helpful Discord server bot assistant. You have memory of the preceding conversation in this channel. Keep answers concise, clear, and direct for Discord chat.'
                    }
                ]);
            }

            const history = channelMemories.get(message.channel.id);

            // Add new user message to history
            history.push({ role: 'user', content: `${message.author.username}: ${prompt}` });

            // Call Groq API with full message history
            const completion = await groq.chat.completions.create({
                messages: history,
                model: 'llama-3.3-70b-versatile'
            });

            const reply = completion.choices[0]?.message?.content || 'I could not process that request.';

            // Save bot reply to history
            history.push({ role: 'assistant', content: reply });

            // Keep memory capped at 60 messages (plus system prompt = 61 total)
            if (history.length > 61) {
                history.splice(1, 2); // Remove oldest user/assistant pair
            }

            // Handle Discord 2000-character message limit
            if (reply.length > 2000) {
                message.reply(reply.slice(0, 1995) + '...');
            } else {
                message.reply(reply);
            }
        } catch (error) {
            console.error('Groq AI Error:', error);
            message.reply('❌ Skelerix hit a snag while processing that query. Check server logs.');
        }
    }

    // Game Update Command: >update Version | Title | Changelog
    if (message.content.startsWith(`${PREFIX}update `)) {
        const args = message.content.slice(PREFIX.length + 7).split('|');
        if (args.length < 3) {
            return message.reply(`❌ **Format:** \`${PREFIX}update Version | Title | Changelog\``);
        }

        const version = args[0].trim();
        const title = args[1].trim();
        const changelog = args[2].trim();

        const channel = await client.channels.fetch(GAME_UPDATE_CHANNEL_ID);
        if (!channel) return message.reply('❌ Game update channel not found.');

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

        await channel.send({ 
            content: '📢 **A new game update has landed!**', 
            embeds: [embed] 
        });

        message.reply(`✅ Game update posted to <#${GAME_UPDATE_CHANNEL_ID}> by Skelerix!`);
    }

    // Lockdown Command: >lockdown
    if (message.content === `${PREFIX}lockdown` || message.content === `${PREFIX}lock`) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
            return message.reply('❌ You need the `Manage Channels` permission to lock down.');
        }

        const channels = message.guild.channels.cache.filter(c => c.isTextBased());
        const everyoneRole = message.guild.roles.everyone;

        for (const [id, channel] of channels) {
            try {
                await channel.permissionOverwrites.edit(everyoneRole, { SendMessages: false });
            } catch (err) {
                console.error(`Error locking ${channel.name}:`, err);
            }
        }

        message.channel.send('Server has been locked down!(✿◠‿◠)');
    }

    // Unlock Command: >unlock
    if (message.content === `${PREFIX}unlock`) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
            return message.reply('❌ You need the `Manage Channels` permission to unlock.');
        }

        const channels = message.guild.channels.cache.filter(c => c.isTextBased());
        const everyoneRole = message.guild.roles.everyone;

        for (const [id, channel] of channels) {
            try {
                await channel.permissionOverwrites.edit(everyoneRole, { SendMessages: null });
            } catch (err) {
                console.error(`Error unlocking ${channel.name}:`, err);
            }
        }

        message.channel.send('Server has been unlocked!(✿◠‿◠)');
    }
});

client.login(process.env.DISCORD_TOKEN);
