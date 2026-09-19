require("dotenv").config();

const {
    REST,
    Routes,
    SlashCommandBuilder,
    PermissionFlagsBits,
    ApplicationIntegrationType,
    InteractionContextType,
    ChannelType
} = require("discord.js");

const enableUserInstall = builder =>
    builder
        .setIntegrationTypes([
            ApplicationIntegrationType.GuildInstall,
            ApplicationIntegrationType.UserInstall
        ])
        .setContexts([
            InteractionContextType.Guild,
            InteractionContextType.BotDM,
            InteractionContextType.PrivateChannel
        ]);

const commands = [

    enableUserInstall(
        new SlashCommandBuilder()
            .setName("sai")
            .setDescription("Ask Skelerix AI anything.")
            .addStringOption(o =>
                o.setName("prompt")
                    .setDescription("What to ask?")
                    .setRequired(true)
            )
    ),

    enableUserInstall(
        new SlashCommandBuilder()
            .setName("saireset")
            .setDescription("Clear Skelerix memory.")
    ),

    enableUserInstall(
        new SlashCommandBuilder()
            .setName("ping")
            .setDescription("Check bot and AI latency.")
    ),

    enableUserInstall(
        new SlashCommandBuilder()
            .setName("update")
            .setDescription("Manually check RSS feeds.")
    ),

    enableUserInstall(
        new SlashCommandBuilder()
            .setName("gameupd")
            .setDescription("Post a game update.")
            .addChannelOption(o =>
                o.setName("channel")
                    .setDescription("Target channel")
                    .addChannelTypes(
                        ChannelType.GuildText,
                        ChannelType.GuildAnnouncement
                    )
                    .setRequired(true)
            )
            .addStringOption(o =>
                o.setName("game")
                    .setDescription("Game name")
                    .setRequired(true)
            )
            .addStringOption(o =>
                o.setName("version")
                    .setDescription("Version")
                    .setRequired(true)
            )
            .addStringOption(o =>
                o.setName("logs")
                    .setDescription("Patch notes")
                    .setRequired(true)
            )
            .setDefaultMemberPermissions(
                PermissionFlagsBits.ManageMessages
            )
    ),

    enableUserInstall(
        new SlashCommandBuilder()
            .setName("coinflip")
            .setDescription("Flip a coin.")
    ),

    enableUserInstall(
        new SlashCommandBuilder()
            .setName("roll")
            .setDescription("Roll a dice.")
            .addIntegerOption(o =>
                o.setName("sides")
                    .setDescription("Number of sides")
                    .setMinValue(2)
                    .setMaxValue(1000)
            )
    ),

    enableUserInstall(
        new SlashCommandBuilder()
            .setName("poll")
            .setDescription("Create a quick poll.")
            .addStringOption(o =>
                o.setName("question")
                    .setDescription("Poll question")
                    .setRequired(true)
            )
    ),

    enableUserInstall(
        new SlashCommandBuilder()
            .setName("serverinfo")
            .setDescription("Show server information.")
    ),

    enableUserInstall(
        new SlashCommandBuilder()
            .setName("userinfo")
            .setDescription("Show user information.")
            .addUserOption(o =>
                o.setName("user")
                    .setDescription("User to inspect")
            )
    ),

    enableUserInstall(
        new SlashCommandBuilder()
            .setName("stats")
            .setDescription("Show Skelerix statistics.")
    ),

    enableUserInstall(
        new SlashCommandBuilder()
            .setName("choose")
            .setDescription("Choose randomly.")
            .addStringOption(o =>
                o.setName("options")
                    .setDescription("Comma-separated options")
                    .setRequired(true)
            )
    ),

    enableUserInstall(
        new SlashCommandBuilder()
            .setName("8ball")
            .setDescription("Ask the magic 8-ball.")
            .addStringOption(o =>
                o.setName("question")
                    .setDescription("Your question")
                    .setRequired(true)
            )
    ),

    enableUserInstall(
        new SlashCommandBuilder()
            .setName("define")
            .setDescription("Define a word.")
            .addStringOption(o =>
                o.setName("word")
                    .setDescription("Word or phrase")
                    .setRequired(true)
            )
    ),

    enableUserInstall(
        new SlashCommandBuilder()
            .setName("translate")
            .setDescription("Translate text.")
            .addStringOption(o =>
                o.setName("text")
                    .setDescription("Text to translate")
                    .setRequired(true)
            )
            .addStringOption(o =>
                o.setName("language")
                    .setDescription("Target language")
                    .setRequired(true)
            )
    ),

    enableUserInstall(
        new SlashCommandBuilder()
            .setName("remind")
            .setDescription("Set a reminder.")
            .addStringOption(o =>
                o.setName("when")
                    .setDescription("30s, 10m, 2h, or 1d")
                    .setRequired(true)
            )
            .addStringOption(o =>
                o.setName("message")
                    .setDescription("Reminder message")
                    .setRequired(true)
            )
    ),

    enableUserInstall(
        new SlashCommandBuilder()
            .setName("timeout")
            .setDescription("Timeout a user.")
            .addUserOption(o =>
                o.setName("user")
                    .setDescription("User to timeout")
                    .setRequired(true)
            )
            .addIntegerOption(o =>
                o.setName("duration")
                    .setDescription("Duration in minutes")
                    .setRequired(true)
            )
            .setDefaultMemberPermissions(
                PermissionFlagsBits.ModerateMembers
            )
    ),

    enableUserInstall(
        new SlashCommandBuilder()
            .setName("tape")
            .setDescription("Tape Skelerix's mouth.")
            .addBooleanOption(o =>
                o.setName("status")
                    .setDescription("True to tape, false to remove")
                    .setRequired(true)
            )
    )

].map(command => command.toJSON());

const rest =
    new REST({ version: "10" })
        .setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        const user =
            await rest.get(Routes.user());

        const clientId = user.id;

        const guildId =
            process.env.GUILD_ID || null;

        if (guildId) {
            await rest.put(
                Routes.applicationGuildCommands(
                    clientId,
                    guildId
                ),
                {
                    body: commands
                }
            );
        }

        await rest.put(
            Routes.applicationCommands(clientId),
            {
                body: commands
            }
        );

        console.log(
            "[SUCCESS] All slash commands deployed!"
        );

    } catch (error) {
        console.error(
            "[DEPLOY ERROR]",
            error
        );
    }
})();