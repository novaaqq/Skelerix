const { Client, GatewayIntentBits } = require('discord.js');
const http = require('http');

// Simple web server to satisfy Render's Web Service check
http.createServer((req, res) => {
    res.write("Bot is running!");
    res.end();
}).listen(process.env.PORT || 3000);

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

client.once('ready', () => {
    console.log(`Bot is online as ${client.user.tag}!`);
});

client.on('messageCreate', message => {
    if (message.content === '!ping') {
        message.reply('Pong! 🏓');
    }
});

client.login(process.env.DISCORD_TOKEN);
