const { SlashCommandBuilder } = require('@discordjs/builders');

const itemData = {
    r: require('../itemdata/radicals.json'),
    k: require('../itemdata/kanji.json'),
    v: require('../itemdata/vocab.json'),
};

const itemNames = {
    r: 'Radical',
    k: 'Kanji',
    v: 'Vocab',
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mnemonic')
        .setDescription('Get the mnemonic for a specific WaniKani item.')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('Name of the item (e.g. "大" or "big").')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Type of the item (radical, kanji, or vocab).')
                .setRequired(false)
                .addChoices(
                    { name: 'Radical', value: 'r' },
                    { name: 'Kanji', value: 'k' },
                    { name: 'Vocab', value: 'v' },
                )),
    async execute(interaction) {
        const getMeanings = meaning => meaning.split(', ').map(e => e.toLowerCase());
        const findItem = (arr, name) => arr.find(e => e.char == name || getMeanings(e.meaning).includes(name.toLowerCase()));

        // get item
        let name = interaction.options.getString('name'),
            type = interaction.options.getString('type');
        let item;
        if (type != null) item = findItem(itemData[type], name);
        else for (const [arr, arrType] of [[itemData.r, 'r'], [itemData.k, 'k'], [itemData.v, 'v']]) {
            item = findItem(arr, name);
            if (item != undefined) {
                type = arrType;
                break;
            }
        }
        // respond
        if (item == undefined) {
            interaction.reply({ content: 'Sorry, but the requested item could not be found!', ephemeral: true });
        } else {
            let itemName = '**' + (item.char != null ? item.char : item.meaning) + '**',
                itemMeaning = item.char != null ? ' (' + item.meaning + ')' : '',
                itemType = ': ' + itemNames[type],
                itemLevel = ' from Level ' + item.level,
                itemMnemonic = '\n```' + item.mnemonic + '```',
                itemHint = item.hint != undefined ? ('\nHint:```' + item.hint + '```') : '';
            interaction.reply({ content: itemName + itemMeaning + itemType + itemLevel + itemMnemonic + itemHint });
        }
    }
};