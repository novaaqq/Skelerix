require('dotenv').config();
const { 
    REST, 
    Routes, 
    SlashCommandBuilder, 
    ApplicationIntegrationType, 
    InteractionContextType, 
    ChannelType, 
    PermissionFlagsBits 
} = require('discord.js');

// Configures commands to work in Servers, Bot DMs, and Group DMs
const enableUserInstall = (builder) => {
    return builder
        .setIntegrationTypes([
            ApplicationIntegrationType.GuildInstall, 
            ApplicationIntegrationType.UserInstall
        ])
        .setContexts([
            InteractionContextType.Guild, 
            InteractionContextType.BotDM, 
            InteractionContextType.PrivateChannel
        ]);
};

// ==========================================
// SLASH COMMAND DEFINITIONS
// ==========================================
const commands = [
    enableUserInstall(
        new SlashCommandBuilder()
            .setName('sai')
            .setDescription('Ask Skelerix AI anything.')
            .addStringOption(o => o.setName('prompt').setDescription('What to ask?').setRequired(true))
    ),
    enableUserInstall(
        new SlashCommandBuilder()
            .setName('saireset')
            .setDescription("Clear Skelerix's short-term chat memory for this channel.")
    ),
    enableUserInstall(
        new SlashCommandBuilder()
            .setName('ping')
            .setDescription('Check Skelerix status, bot latency, and AI response speed.')
    ),
    enableUserInstall(
        new SlashCommandBuilder()
            .setName('update')
            .setDescription('Manually trigger an RSS feed check for TikTok and YouTube updates.')
    ),
    enableUserInstall(
        new SlashCommandBuilder()
            .setName('gameupd')
            .setDescription('Post an official game update announcement.')
            .addChannelOption(o => 
                o.setName('channel')
                 .setDescription('The target channel to send the announcement to')
                 .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                 .setRequired(true)
            )
            .addStringOption(o => 
                o.setName('game')
                 .setDescription('Name of the game being updated')
                 .setRequired(true)
            )
            .addStringOption(o => 
                o.setName('version')
                 .setDescription('Update version (e.g., v1.2.0 or Beta 2.0)')
                 .setRequired(true)
            )
            .addStringOption(o => 
                o.setName('logs')
                 .setDescription('The update logs / patch notes (Use \\n for new lines)')
                 .setRequired(true)
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    ),
    enableUserInstall(
        new SlashCommandBuilder()
            .setName('coinflip')
            .setDescription('Flip a coin! Heads or Tails?')
    ),
    enableUserInstall(
        new SlashCommandBuilder()
            .setName('roll')
            .setDescription('Roll a dice.')
            .addIntegerOption(o => o.setName('sides').setDescription('Number of sides (default 6)').setRequired(false))
    ),
    enableUserInstall(
        new SlashCommandBuilder()
            .setName('poll')
            .setDescription('Create a quick interactive poll.')
            .addStringOption(o => o.setName('question').setDescription('The poll question').setRequired(true))
    ),
    enableUserInstall(
        new SlashCommandBuilder()
            .setName('serverinfo')
            .setDescription('Check out community stats.')
    ),
    enableUserInstall(
        new SlashCommandBuilder()
            .setName('timeout')
            .setDescription('Timeout a disruptive user.')
            .addUserOption(o => o.setName('user').setDescription('The user to timeout').setRequired(true))
            .addIntegerOption(o => o.setName('duration').setDescription('Duration in minutes').setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    ),
    enableUserInstall(
        new SlashCommandBuilder()
            .setName('tape')
            .setDescription("Put tape over Skelerix's mouth (Owner only).")
            .addBooleanOption(o => o.setName('status').setDescription('True to tape, False to remove tape').setRequired(true))
    ),
    enableUserInstall(
        new SlashCommandBuilder()
            .setName('remind')
            .setDescription('Set a reminder.')
            .addIntegerOption(o => o.setName('minutes').setDescription('Time in minutes from now').setRequired(true))
            .addStringOption(o => o.setName('task').setDescription('What to remind you about').setRequired(true))
    ),
    enableUserInstall(
        new SlashCommandBuilder()
            .setName('stats')
            .setDescription('Show bot statistics.')
    ),
    enableUserInstall(
        new SlashCommandBuilder()
            .setName('userinfo')
            .setDescription('Show user information.')
            .addUserOption(o => o.setName('target').setDescription('The user to inspect').setRequired(false))
    ),
    enableUserInstall(
        new SlashCommandBuilder()
            .setName('choose')
            .setDescription('Randomly choose an option from a comma-separated list.')
            .addStringOption(o => o.setName('options').setDescription('Options separated by commas').setRequired(true))
    ),
    enableUserInstall(
        new SlashCommandBuilder()
            .setName('8ball')
            .setDescription('Ask the magic 8-ball a question.')
            .addStringOption(o => o.setName('question').setDescription('Your question').setRequired(true))
    ),
    enableUserInstall(
        new SlashCommandBuilder()
            .setName('define')
            .setDescription('Define a word or phrase.')
            .addStringOption(o => o.setName('term').setDescription('Word or phrase to define').setRequired(true))
    ),
    enableUserInstall(
        new SlashCommandBuilder()
            .setName('translate')
            .setDescription('Translate text to a target language.')
            .addStringOption(o => o.setName('text').setDescription('Text to translate').setRequired(true))
            .addStringOption(o => o.setName('language').setDescription('Target language').setRequired(true))
    )
].map(c => c.toJSON());

// ==========================================
// DEPLOYMENT SCRIPT
// ==========================================
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
            console.error('❌ Missing DISCORD_TOKEN or CLIENT_ID in environment variables!');
            process.exit(1);
        }

        console.log(`🚀 Started refreshing ${commands.length} application (/) commands...`);

        // Deploys globally across all servers and DMs
        const data = await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands }
        );

        console.log(`✅ Successfully reloaded ${data.length} global application (/) commands!`);
    } catch (error) {
        console.error('❌ Error deploying commands:', error);
    }
})();
