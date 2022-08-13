// console logging
const namespace = 'Slash';
const { logger, errorAwait } = require('../helpers/logger.js');

// requires
const { SlashCommandBuilder } = require('@discordjs/builders');
const { errorEmbed, pendingEmbed, simpleEmbed } = require('../helpers/embedder.js');

// naming scheme
const { itemNames, wkItemNames, wkItemColors } = require('../helpers/namer.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mnemonic')
        .setDescription('Get the mnemonic for a specific or random WaniKani item.')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('Name of the item (e.g. "大" or "big").')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Type of the item (radical, kanji, or vocab).')
                .setRequired(false)
                .addChoices(
                    { name: 'Radical', value: 'r' },
                    { name: 'Kanji', value: 'k' },
                    { name: 'Vocab', value: 'v' },
                ))
        .addIntegerOption(option =>
            option.setName('level')
                .setDescription('Level of the item.')
                .setRequired(false)),
    async execute(interaction) {
        const { subjectData } = require('../handlers/wkapiHandler.js');
        logger(namespace, `Mnemonic - Initiated by "${(interaction.user != undefined ? interaction.user.username : 'Unknown')}"`, 'Sent', new Date());

        const name = interaction.options.getString('name'),
            level = interaction.options.getInteger('level');
        var type = interaction.options.getString('type');

        // embeds
        const embedTitle = 'Item Data';
        var embedInfo = itemNames[type] + ' ' + name;
        const changeEmbed = async embed => await interaction.editReply({ embeds: [embed] });

        await interaction.reply({ embeds: [pendingEmbed(embedTitle, 'Searching for the item...', embedInfo)] });

        const getMeanings = e => e.map(e => e.meaning.toLowerCase());
        
        // get item
        const items = subjectData.filter(e => (level == null || e.data.level == level) && (name == null || e.data.characters == name || e.data.slug.toLowerCase() == name.toLowerCase() || getMeanings(e.data.meanings).includes(name.toLowerCase())) && (type == null || e.object == wkItemNames[type]));
        const item = items[Math.floor(Math.random() * items.length)];
        // respond
        if (item == undefined) {
            await changeEmbed(errorEmbed(embedTitle, 'Sorry, but the requested item could not be found!'), embedInfo);
        } else {
            embedInfo = item.object + ' ' + item.data.characters;
            type = item.object[0].toLowerCase();
            embedInfo = itemNames[type] + ' ' + item.data.slug + ' (Level ' + item.data.level + ')';
            var itemEmbed = simpleEmbed(wkItemColors[type], embedTitle + ' - ' + embedInfo, (items.length != 1 ? '(Randomly selected out of ' + items.length + ' items.)\n\n' : '') + '**Meaning Mnemonic:**```' + item.data.meaning_mnemonic + '```' + (item.data.meaning_hint != undefined ? ('Hint:```' + item.data.meaning_hint + '```') : '') + (item.data.reading_mnemonic != undefined ? '\n**Reading Mnemonic:**```' + item.data.reading_mnemonic + '```' + (item.data.reading_hint != undefined ? ('Hint:```' + item.data.reading_hint + '```') : '') : ''))
                .setURL(item.data.document_url)
                .addFields(
                    ...(item.data.meanings != undefined ? [{ name: 'Meaning(s)', value: item.data.meanings.map(e => e.meaning).join(', '), inline: true }] : []),
                    ...(item.data.readings != undefined ? [{ name: 'Reading(s)', value: item.data.readings.map(e => e.reading).join(', '), inline: true }] : []),
                    ...(item.data.parts_of_speech != undefined ? [{ name: 'Word Type', value: item.data.parts_of_speech.join(', '), inline: true }] : []),
                    { name: 'WK ID', value: item.id.toString(), inline: true }
            );
            if (item.data.character_images != undefined) {
                const characterImage = item.data.character_images.find(e => e.content_type == 'image/png' && parseInt(e.metadata.dimensions.split('x')) < 1000);
                if (characterImage) itemEmbed = itemEmbed.setThumbnail(characterImage.url);
            }
            await changeEmbed(itemEmbed);
        }
    }
};