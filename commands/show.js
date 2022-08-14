// console logging
const namespace = 'Slash';
const { logger, errorAwait } = require('../helpers/logger.js');

// requires
const { SlashCommandBuilder } = require('@discordjs/builders');
const { errorEmbed, pendingEmbed, successEmbed, pagesEmbed } = require('../helpers/embedder.js');

// database
const { finder } = require('../handlers/mongoHandler.js');

// parameters
const progressbarWidth = 25;

// naming schemes
const { itemNames, mnemonicNames } = require('../helpers/namer.js');

var prevCollector;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('show')
        .setDescription('Shows progress of the project and details about submissions.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('progress')
                .setDescription('Show the progress of this project.')
                .addStringOption(option =>
                    option.setName('type')
                        .setDescription('Type of the items (radical, kanji, or vocab).')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Radical', value: 'r' },
                            { name: 'Kanji', value: 'k' },
                            { name: 'Vocab', value: 'v' },
                        ))
                .addIntegerOption(option =>
                    option.setName('level')
                        .setDescription('Level of the items.')
                        .setRequired(false)))
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
            const subjectData = require('../handlers/wkapiHandler.js').subjectData;
            const type = interaction.options.getString('type'),
                level = interaction.options.getInteger('level');

            const percentToBar = (p, n) => {//█▁ or #-
                let k = parseInt(p * n);
                return '█'.repeat(k) + '▁'.repeat(n-k);
            }
            const dataquery = await errorAwait(namespace, async () => await finder({
                ...(type && { type: type }),
                ...(level && { level: level }),
            }), [], 'Progress -', true);
            if (!dataquery) {
                await changeEmbed(errorEmbed(embedTitle, 'Sorry, but there was a database error!'));
                return false;
            }
            const itemsFinished = dataquery.length,
                itemsTotal = subjectData.filter(e => (type == null || e.object[0].toLowerCase() == type) && (level == null || e.data.level == level)).length,
                submissionAmount = dataquery.map(e => e.submissions.length).reduce((p, c) => p + c, 0);
            const percentage = itemsFinished / itemsTotal;
            await changeEmbed(successEmbed(embedTitle + ' - ' + (type != null ? itemNames[type] + (type == 'r' ? 's' : '') : 'Items') + (level != null ? ' of Level ' + level : ''), `${percentToBar(percentage, progressbarWidth)}  ${(percentage * 100).toFixed(2)}%\n\n` + 'To see these submissions use `/show submissions' + (level != null ? ` level:${level}` : '') + (type != null ? ` type:${itemNames[type]}` : '') + '`.')
                .addFields(
                    { name: 'Items Done', value: itemsFinished.toString(), inline: true },
                    ...(type != 'r' ? [{ name: 'Meaning Done', value: dataquery.filter(i => i.submissions.findIndex(e => e.mnemonictype == 'b') != -1 || i.submissions.findIndex(e => e.mnemonictype == 'm')).length.toString(), inline: true }] : []),
                    ...(type != 'r' ? [{ name: 'Reading Done', value: dataquery.filter(i => i.submissions.findIndex(e => e.mnemonictype == 'b') != -1 || i.submissions.findIndex(e => e.mnemonictype == 'r')).length.toString(), inline: true }] : []),
                    { name: 'Submissions', value: submissionAmount.toString(), inline: false },
                )
                .setTimestamp());
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
                ...(meaning && { meaning: { $regex: meaning } }),
                ...(type && { type: type }),
                ...(level && { level: level }),
            }).then(subs => subs.map(item => item.submissions.filter(s => (mnemonictype == null || s.mnemonictype == mnemonictype) && (user == null || s.user[0] == user.id) && (accepted == null || s.accepted == accepted) && (source == null || s.source == source)).map(s => ({char: item.char, meaning: item.meaning, type: item.type, level: item.level, ...s}))).flat());
            if (submissions.length == 0) {
                await changeEmbed(simpleEmbed(0x707070, 'Submissions - None Found', 'There are no submissions with the selected properties.'))
                return true;
            }
            var currentSub = 0;
            const updatePages = async (i, edit = false) => {
                const sub = submissions[currentSub];
                const embed = pagesEmbed(0x707070, 'Submissions - ' + (currentSub + 1) + ' out of ' + submissions.length, `Submitted on ${sub.date.toUTCString()} by ${sub.user[1]}. The image was uploaded [here](${sub.imagelink}).` + '\nFor more info on this item use `' + `/mnemonic name:${sub.char} type:${itemNames[sub.type]} level:${sub.level}` + '`.', [
                    ...((char || meaning || type || level || mnemonictype || user || accepted || source) ? [{ name: 'Parameters', value: '\u200B', inline: false }] : []),
                    ...(char ? [{ name: 'Char', value: char, inline: true }] : []),
                    ...(meaning ? [{ name: 'Meaning', value: meaning, inline: true }] : []),
                    ...(type ? [{ name: 'Type', value: itemNames[type], inline: true }] : []),
                    ...(level ? [{ name: 'Level', value: level.toString(), inline: true }] : []),
                    ...(mnemonictype ? [{ name: 'Mnemonic', value: mnemonicNames[mnemonictype], inline: true }] : []),
                    ...(user ? [{ name: 'User', value: user.username + '#' + user.discriminator, inline: true }] : []),
                    ...(accepted ? [{ name: 'Accepted', value: accepted ? 'Yes' : 'No', inline: true }] : []),
                    ...(source ? [{ name: 'Source', value: source, inline: true }] : []),
                    ...((char || meaning || type || level || mnemonictype || user || accepted || source) ? [{ name: '\u200B', value: '\u200B', inline: false }] : []),

                    ...(!(char && meaning && type && level && mnemonictype && user && accepted && source) ? [{ name: 'Properties', value: '\u200B', inline: false }] : []),
                    ...(!char ? [{ name: 'Char', value: sub.char, inline: true }] : []),
                    ...(!meaning ? [{ name: 'Meaning', value: sub.meaning, inline: true }] : []),
                    ...(!type ? [{ name: 'Type', value: itemNames[sub.type], inline: true }] : []),
                    ...(!level ? [{ name: 'Level', value: sub.level.toString(), inline: true }] : []),
                    ...(!mnemonictype ? [{ name: 'Mnemonic', value: mnemonicNames[sub.mnemonictype], inline: true }] : []),
                    ...(!user ? [{ name: 'User', value: sub.user[1], inline: true }] : []),
                    ...(!accepted ? [{ name: 'Accepted', value: sub.accepted ? 'Yes' : 'No', inline: true }] : []),
                    ...(!source ? [{ name: 'Source', value: sub.source, inline: true }] : []),
                ], sub.thumblink, currentSub == submissions.length - 1, currentSub == 0);
                return await (edit ? i.editReply(embed) : i.update(embed));
            }
            updatePages(interaction, true);

            if (prevCollector != undefined) await prevCollector.stop(); // delete old message
            const collector = interaction.channel.createMessageComponentCollector({ filter: i => ['fullLeft', 'left', 'random', 'right', 'fullRight'].includes(i.customId), time: 300000 }); // 5 minutes
            prevCollector = collector;
            collector.on('collect', async i => {
                switch (i.customId) {
                    case 'fullLeft': currentSub = 0; break;
                    case 'left': currentSub = currentSub <= 0 ? 0 : currentSub - 1; break;
                    case 'random': currentSub = Math.floor(Math.random() * submissions.length); break;
                    case 'right': currentSub = currentSub >= submissions.length - 1 ? submissions.length - 1 : currentSub + 1; break;
                    case 'fullRight': currentSub = submissions.length - 1; break;
                }
                await updatePages(i);
            });
            collector.on('end', collected => {
                interaction.deleteReply();
                logger(namespace, `Collector - ${collected.size} Button Press(es)`, 'Terminated');
            });
        }
        return true;
    }
};