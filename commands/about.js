// console logging
const namespace = 'Slash';
const { logger } = require('../helpers/logger.js');

// requires
const { discord: { channelIds: { gettingStartedId }, userIds } } = require('../../tokens.json');
const { version } = require('../package.json');
const { SlashCommandBuilder } = require('@discordjs/builders');
const { simpleEmbed, linkRow } = require('../helpers/embedder.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('about')
        .setDescription('Information about this project.'),
    async execute(interaction) {
        logger(namespace, `About - Initiated by "${(interaction.user != undefined ? interaction.user.username : 'Unknown')}"`, 'Sent', new Date());

        await interaction.reply({
            embeds: [
                simpleEmbed(0xeb7a34, 'About', `**Mnemonic Images Project**\nThis is a project started by a WaniKani user in this [thread](https://community.wanikani.com/t/wanikani-mnemonics-in-image-form-done-by-ai/57910).\nIts goal is to turn the mnemonics for the reading and meaning of Japanese words and kanji into an image form. This will generally be done by feeding an AI a prompt and getting an image back. But other ways, such as drawing, are fair game as well! These images are then seen on the WaniKani website by anyone using the dedicated userscript.\n*Everyone* that is interested can and should participate (it's free, try it). For more info on how to participate check out <#${gettingStartedId}>.\n\n**Crabigator Bot**\nThis is a discord bot created specifically for the purpose of managing submissions for the Mnemonic Images Project, as well as other tasks regarding this project.`)
                    .addFields({ name: 'Developer', value: `<@${userIds.saraqael}>`, inline: true },
                        { name: 'Codevelopers', value: `<@${userIds.chiara}>, <@${userIds.akhdanfadh}>`, inline: true },
                        { name: 'Version', value: version, inline: true })
            ],
            components: [
                linkRow([['WK Userscript', 'https://greasyfork.org/en/scripts/448713-wanikani-ai-mnemonic-images'], ['Bot GitHub', 'https://github.com/saraqael-m/CrabigatorBot']])
            ]
        });
    }
};