require('dotenv').config();
const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const commands = [
    new SlashCommandBuilder().setName('sai').setDescription('Ask Skelerix AI a direct question.').addStringOption(o => o.setName('prompt').setDescription('What to ask?').setRequired(true)),
    new SlashCommandBuilder().setName('ping').setDescription('Check Skelerix status, bot latency, and AI response speed.'),
    new SlashCommandBuilder().setName('coinflip').setDescription('Flip a coin! Heads or Tails?'),
    new SlashCommandBuilder().setName('roll').setDescription('Roll a dice.').addIntegerOption(o => o.setName('sides').setDescription('Number of sides (default 6)').setRequired(false)),
    new SlashCommandBuilder().setName('poll').setDescription('Create a quick interactive poll.').addStringOption(o => o.setName('question').setDescription('The poll question').setRequired(true)),
    new SlashCommandBuilder().setName('serverinfo').setDescription('Check out community stats.'),
    new SlashCommandBuilder().setName('timeout').setDescription('Timeout a disruptive user.').addUserOption(o => o.setName('user').setDescription('The user to timeout').setRequired(true)).addIntegerOption(o => o.setName('duration').setDescription('Duration in minutes').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    new SlashCommandBuilder().setName('tape').setDescription("Put tape over Skelerix's mouth (Owner only).").addBooleanOption(o => o.setName('status').setDescription('True to tape, False to remove tape').setRequired(true))
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('[CLEANUP] Fetching bot application ID...');
        const application = await rest.get(Routes.user());
        const clientId = application.id;

        // If you ever registered commands to a specific server, enter your Server ID here to clear them:
        const GUILD_ID = process.env.GUILD_ID || null;
        if (GUILD_ID) {
            console.log('[CLEANUP] Clearing guild-specific commands...');
            await rest.put(Routes.applicationGuildCommands(clientId, GUILD_ID), { body: [] });
        }

        console.log('[DEPLOY] Registering clean global commands...');
        await rest.put(Routes.applicationCommands(clientId), { body: commands });
        console.log('[SUCCESS] Slash commands refreshed successfully!');
    } catch (error) {
        console.error('[ERROR]:', error);
    }
})();
