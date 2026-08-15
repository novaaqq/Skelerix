const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const Parser = require('rss-parser');
const http = require('http');

// Web server for Render health checks
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

// --- CONFIGURATION ---
const YOUTUBE_ANNOUNCEMENT_CHANNEL_ID = '1536854741756284958'; // YouTube videos go here
const GAME_UPDATE_CHANNEL_ID = '1536854230239805605';         // Game updates go here

const YOUTUBE_CHANNEL_ID = 'UCcX_U3PVmP7KTiIhqJ9_8kg'; // Your YouTube Channel ID
const BRAND_COLOR = 0x0099FF; // Blue theme

let lastVideoId = '';

client.once('ready', () => {
    console.log(`Skelerix is online and listening as ${client.user.tag}!`);
    
    // Check YouTube feed every 5 minutes
    checkYouTube();
    setInterval(checkYouTube, 5 * 60 * 1000);
});

// --- AUTOMATED YOUTUBE ANNOUNCEMENTS ---
async function checkYouTube() {
    try {
        const feed = await parser.parseURL(`https://www.youtube.com/feeds/videos.xml?channel_id=${YOUTUBE_CHANNEL_ID}`);
        if (!feed.items || feed.items.length === 0) return;

        const latestVideo = feed.items[0];
        const videoId = latestVideo.id.split(':')[2];

        // Store latest video on startup without posting old videos
        if (lastVideoId === '') {
            lastVideoId = videoId;
            return;
        }

        // Send alert on new upload
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
    if (message.author.bot) return;

    // Ping Check
    if (message.content === '!ping') {
        message.reply('💀 **Skelerix is active and online!** 🌀');
    }

    // Game Update Command: !update Version | Title | Changelog
    // Example: !update v1.0 | Big Patch | - Added combat mechanics\n- Fixed UI bugs
    if (message.content.startsWith('!update ')) {
        const args = message.content.slice(8).split('|');
        if (args.length < 3) {
            return message.reply('❌ **Format:** `!update Version | Title | Changelog`');
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
});

client.login(process.env.DISCORD_TOKEN);
