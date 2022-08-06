const { SlashCommandBuilder } = require('@discordjs/builders');

const databaseName = 'mnemonicDB.json',
    progressbarWidth = 40;

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
        .setName('show')
        .setDescription('Shows progress of the project and details about submissions.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('progress')
                .setDescription('Show the progress of this project.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('submissions')
                .setDescription('Show currently submitted images.')
                .addIntegerOption(option =>
                    option.setName('level')
                        .setDescription('WK level of submission.')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('char')
                        .setDescription('Item\'s name or characters.')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('meaning')
                        .setDescription('Item\'s meaning.')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('type')
                        .setDescription('Type of item (radical, kanji, or vocab).')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('mnemonictype')
                        .setDescription('Type of mnemonic (reading, meaning, or both).')
                        .setRequired(false))
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User who submitted the item.')
                        .setRequired(false))
                .addBooleanOption(option =>
                    option.setName('accepted')
                        .setDescription('If item was accepted.')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('source')
                        .setDescription('Item\'s source (e.g. "DALL-E 2" or "Midjourney".')
                        .setRequired(false))),
    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub == 'progress') {
            const percentToBar = (p, n) => {
                let k = parseInt(p * n);
                return '#'.repeat(k) + '-'.repeat(n-k);
            }
            const [itemsFinished, itemsTotal, submissionAmount] = await require('../DBhandler.js').progress(); // db call
            const percentage = itemsFinished / itemsTotal;
            interaction.reply({ content: `**Progress**\nSubmissions: ${submissionAmount}\nItems Finished: ${itemsFinished}/${itemsTotal}\n[${percentToBar(percentage, progressbarWidth)}] ${(percentage*100).toFixed(2)}%`});
        } else if (sub == 'submissions') {
            const submissions = await require('../DBhandler.js').get(
                interaction.options.getString('char'),
                interaction.options.getString('meaning'),
                interaction.options.getString('type'),
                interaction.options.getInteger('level'),
                interaction.options.getString('mnemonictype'),
                interaction.options.getUser('user'),
                interaction.options.getBoolean('accepted'),
                interaction.options.getString('source')
            );
            const message = await interaction.reply({
                content: 'Found submission(s):' + submissions.length,
                fetchReply: true
            });

            const addReactions = async () => await message.react('⬅️').then(() => message.react('➡️'));
            const updateMessage = msg => {
                //msg.reactions.removeAll();
                //addReactions();
                console.log(subPos);
                msg.edit('Submission ' + subPos + ' of ' + submissions.length);
            }
            var subPos = 0;
            await addReactions().then(updateMessage(message));

            const filter = (reaction, user) => {
                console.log(reaction.emoji.name)
                return ['⬅️', '➡️'].includes(reaction.emoji.name) && user.id === interaction.user.id;
            };

            message.awaitReactions({ filter, max: 5, time: 60000, errors: ['time'] })
                .then(collected => {
                    const reaction = collected.first();

                    if (reaction.emoji.name === '⬅️') {
                        subPos = subPos <= 0 ? 0 : subPos - 1;
                        updateMessage(message);
                    } else if (reaction.emoji.name === '➡️') {
                        subPos = subPos >= submissions.length - 1 ? submissions.length - 1 : subPos + 1;
                        updateMessage(message);
                    }
                })
                .catch(collected => {
                    console.log(4);
                });
        }
    }
};