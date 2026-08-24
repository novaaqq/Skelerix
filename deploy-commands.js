require('dotenv').config();
const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const commands = [
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

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('[DEPLOY] Registering clean global slash commands...');
        
        // Auto-detect client application ID from token
        const application = await rest.get(Routes.user());
        const clientId = application.id;

        // Overwrite global commands with clean list
        await rest.put(Routes.applicationCommands(clientId), { body: commands });
        
        console.log('[DEPLOY] Global commands registered successfully!');
        console.log('[DEPLOY] Note: If duplicates still show in Discord, press Ctrl+R to refresh your client UI.');
    } catch (error) {
        console.error('[DEPLOY ERROR]:', error);
    }
})();
