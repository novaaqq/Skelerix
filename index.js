require('dotenv').config();

const {
    Client,
    GatewayIntentBits,
    Partials,
    PermissionFlagsBits,
    Events,
    REST,
    Routes,
    SlashCommandBuilder,
    ApplicationIntegrationType,
    InteractionContextType,
    ChannelType,
    MessageFlags
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
});

const SYSTEM_INSTRUCTION =
    "You are Skelerix, a casual, sharp, and quick-witted AI assistant. " +
    "Talk naturally, like a laid-back group chat member. Keep responses concise, " +
    "playful, and clever. Avoid robotic formality and mean roasts—just keep it cool, helpful, and funny.";

const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

const stats = {
    aiRequests: 0,
    mentionReplies: 0,
    commands: 0
};

const reminders = new Map();

const MUFFLES = [
    "*Mmf!*",
    "*Mphf mmrgh!*",
    "*Mmm-mph!*",
    "*Hmph!*",
    "*Mmmph...*",
    "*Muffled noises*"
];

const lastGUIDs = {
    TikTok: null,
    YouTube: null
};

let isTaped = false;
const startedAt = Date.now();

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

const clip = text =>
    text.length > 2000 ? text.slice(0, 1997) + "..." : text;

const randomMuffle = () =>
    MUFFLES[Math.floor(Math.random() * MUFFLES.length)];


// =================================