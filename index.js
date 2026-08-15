const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField } = require('discord.js');
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
const PREFIX = '⛥'; 

const YOUTUBE_ANNOUNCEMENT_CHANNEL_ID = '1536854741756284958'; // YouTube channel
const GAME_UPDATE_CHANNEL_ID = '1536854230239805605';         // Game update channel

const YOUTUBE_CHANNEL_ID = 'UCcX_U3PVmP7KTiIhqJ9_8kg'; // YouTube Channel ID
const BRAND_COLOR = 0x0099FF; // Blue theme

let lastVideoId = '';

client.once('ready', () => {
    console.log(`Skelerix is online and listening as ${client.user.tag}! Prefix: ${PREFIX}`);
    
    // Initial check
    checkYouTube();

    // Check YouTube feed every 10 seconds (Lowest safe interval)
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

// --- COMMANDS ---
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    // Ping Check: ⛥ping
    if (message.content === `${PREFIX}ping`) {
        message.reply('💀 **Skelerix is active and online!** 🌀');
    }

    // AI Ask Command: ⛥ask [question]
    if (message.content.startsWith(`${PREFIX}ask `)) {
        const prompt = message.content.slice(PREFIX.length + 4).trim();
        if (!prompt) return message.reply('❌ Please provide a question! Example: `⛥ask How do hitboxes work?`');

        try {
            await message.channel.sendTyping();

            const completion = await groq.chat.completions.create({
                messages: [
                    {
                        role: 'system',
                        content: 'You are Skelerix, an intelligent and helpful Discord server bot assistant. Keep answers concise, clear, and direct for Discord chat.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                model: 'llama-3.3-70b-versatile'
            });

            const reply = completion.choices[0]?.message?.content || 'I could not process that request.';
            
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

    // Game Update Command: ⛥update Version | Title | Changelog
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

    // Lockdown Command: ⛥lockdown
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

    // Unlock Command: ⛥unlock
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
