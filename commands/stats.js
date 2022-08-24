// console logging
const logTag = 'Slash';
const { logger } = require('../helpers/logger.js');

// requires
const { discord: { channelIds: { gettingStartedId }, userIds } } = require('../../tokens.json');
const { version } = require('../package.json');
const { SlashCommandBuilder } = require('@discordjs/builders');
const { simpleEmbed, linkRow } = require('../helpers/embedder.js');
const { embedColors } = require('../helpers/styler.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Your statistics regarding this project and WaniKani.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('register')
                .setDescription('Connect to your WaniKani account using your API key.')
                .addStringOption(option =>
                    option.setName('apiv2key')
                        .setDescription('Your APIv2 key.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('show')
                .setDescription('Show project and WaniKani statistics.')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user whose statistics you want to see.')
                        .setRequired(false))
                .addBooleanOption(option =>
                    option.setName('ephemeral')
                        .setDescription('If others should see this message.')
                        .setRequired(false))),
    async execute(interaction) {
        logger(logTag, `Stats - Initiated by "${(interaction.user != undefined ? interaction.user.username : 'Unknown')}"`, 'Sent', new Date());

        const command = interaction.options.getSubcommand();
        const ephemeral = !!(command == 'show' ? interaction.options.getBoolean('ephemeral') : true);

        
    }
};