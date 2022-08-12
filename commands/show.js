// console logging
const namespace = 'Slash';
const { logger, errorAwait } = require('../helpers/logger.js');

// requires
const { SlashCommandBuilder } = require('@discordjs/builders');
const { errorEmbed, pendingEmbed, successEmbed } = require('../helpers/embedder.js');

// database
const { finder } = require('../handlers/mongoHandler.js');

// parameters
const progressbarWidth = 40;

// itemData
const itemData = {
    r: require('../itemdata/radicals.json'),
    k: require('../itemdata/kanji.json'),
    v: require('../itemdata/vocab.json'),
};

// naming schemes
const { itemNames } = require('../helpers/namer.js');

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
                        .setRequired(false).addChoices(
                            { name: 'Midjourney (Paid)', value: 'midjourney_paid' },
                            { name: 'Midjourney (Free)', value: 'midjourney_free' },
                            { name: 'DALL-E 2', value: 'dall-e_2' },
                            { name: 'Other AI (Commercial)', value: 'commercial' },
                            { name: 'Other AI (Personal)', value: 'personal' },
                            { name: 'Own Drawing', value: 'drawing' })))
        .addSubcommand(subcommand =>
            subcommand
                .setName('mysubmissions')
                .setDescription('Show images submitted by yourself.')),
    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        logger(namespace, `Show - '${sub}' Initiated by "${(interaction.user != undefined ? interaction.user.username : 'Unknown')}"`, 'Pending', new Date());

        // embeds
        const titles = {
            progress: 'Progress',
            submissions: 'Submissions',
            mysubmissions: 'My Submissions' + (interaction.user != undefined ? ' - ' + interaction.user.username : '')
        }
        const embedTitle = titles[sub];
        const changeEmbed = async embed => await interaction.editReply({ embeds: [embed] });

        await interaction.reply({ embeds: [pendingEmbed(embedTitle, 'Processing the request...')] });

        if (sub == 'progress') {
            const percentToBar = (p, n) => {
                let k = parseInt(p * n);
                return '#'.repeat(k) + '-'.repeat(n-k);
            }
            const fullDatabase = await errorAwait(namespace, async () => await finder({}), [], 'Progress -', true);
            if (!fullDatabase) {
                await changeEmbed(errorEmbed(embedTitle, 'Sorry, but there was a database error!'));
                return false;
            }
            const itemsFinished = fullDatabase.length,
                itemsTotal = itemData.r.length + itemData.k.length + itemData.v.length,
                submissionAmount = fullDatabase.map(e => e.submissions.length).reduce((p, c) => p + c);
            const percentage = itemsFinished / itemsTotal;
            await changeEmbed(successEmbed(embedTitle, `Submissions: ${submissionAmount}\nItems Finished: ${itemsFinished}/${itemsTotal}\n[${percentToBar(percentage, progressbarWidth)}] ${(percentage * 100).toFixed(2)}%`).setTimestamp());
        } else if (sub == 'submissions' || sub == 'mysubmissions') {
            const onlyUser = sub == 'mysubmissions';
            const char = onlyUser ? null : interaction.options.getString('char'),
                meaning = onlyUser ? null : interaction.options.getString('meaning'),
                type = onlyUser ? null : interaction.options.getString('type'),
                level = onlyUser ? null : interaction.options.getInteger('level'),
                mnemonictype = onlyUser ? null : interaction.options.getString('mnemonictype'),
                user = onlyUser ? interaction.user : interaction.options.getUser('user'),
                accepted = onlyUser ? null : interaction.options.getBoolean('accepted'),
                source = onlyUser ? null : interaction.options.getString('source');
            const submissions = await finder({
                ...(char && { char: char }),
                ...(meaning && { meaning: meaning }),
                ...(type && { type: type }),
                ...(level && { level: level }),
            }).then(subs => subs.map(sub => sub.submissions.filter(s => (mnemonictype == null || s.mnemonictype == mnemonictype) && (user == null || s.user[0] == user.id) && (accepted == null || s.accepted == accepted) && (source == null || s.source == source))).flat());
            await changeEmbed(successEmbed(embedTitle, 'Found ' + submissions.length + ' submission(s).'));
            return;
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
        return true;
    }
};