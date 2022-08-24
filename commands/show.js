// console logging
const logTag = 'Slash';
const { logger, errorAwait } = require('../helpers/logger.js');

// requires
const { SlashCommandBuilder } = require('@discordjs/builders');
const { errorEmbed, pendingEmbed, successEmbed, pagesEmbed, simpleEmbed } = require('../helpers/embedder.js');
const { embedColors, wkItemColors } = require('../helpers/styler.js');
const { itemInfo } = require('../helpers/messager.js');

// database
const { finder } = require('../handlers/mongoHandler.js');

// parameters
const progressbarWidth = 30;
const activeTime = 600000;

// naming schemes
const { itemNames, mnemonicNames } = require('../helpers/namer.js');

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
                .setName('completed')
                .setDescription('Show all the done and not yet completed items for this channel.'))
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
                        .setRequired(false)
                        .addChoices(
                            { name: 'Radical', value: 'r' },
                            { name: 'Kanji', value: 'k' },
                            { name: 'Vocab', value: 'v' },
                        ))
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
                            { name: 'Own Drawing', value: 'drawing' }))
                .addIntegerOption(option =>
                    option.setName('subid')
                        .setDescription('The submission ID.')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('mysubmissions')
                .setDescription('Show images submitted by yourself.')),
    async execute(interaction) {
        const command = interaction.options.getSubcommand();
        logger(logTag, `Show - '${command}' Initiated by "${(interaction.user != undefined ? interaction.user.username : 'Unknown')}"`, 'Pending', new Date());

        // embeds
        const titles = {
            progress: 'Progress',
            submissions: 'Submissions',
            mysubmissions: 'My Submissions' + (interaction.user != undefined ? ' - ' + interaction.user.username : ''),
            completed: 'Items Completed',
        }
        const embedTitle = titles[command];
        const changeEmbed = async embed => await interaction.editReply({ embeds: [embed] });

        const percentToBar = (p1, p2, n) => { //█▄▁
            let k1 = parseInt(p1 * n);
            let k2 = parseInt(p2 * n) - k1;
            return '█'.repeat(k1) + '▄'.repeat(k2) + '▁'.repeat(n - k1 - k2);
        }
        const wholeBar = (a, b, total, decimals = 2) => {
            const progress = b / total;
            return `${percentToBar(a / total, progress, progressbarWidth)} ${(progress * 100).toFixed(decimals)}% (${b}/${total})`;
        }

        const msg = await interaction.reply({ embeds: [pendingEmbed(embedTitle, 'Processing the request...')] });

        if (command == 'completed') {
            const { discord: { channelIds: { itemChannelIds } } } = require('../../tokens.json');
            const { subjectData } = require('../handlers/wkapiHandler.js');
            var itemChannels = {};
            for (const [type, arr] of Object.entries(itemChannelIds)) itemChannels = { ...itemChannels, ...Object.fromEntries(Object.entries(arr).map(a => [a[1], [...a[0].split(', ').map(e => parseInt(e)), type]])) };
            const parameters = itemChannels[interaction.channelId];
            if (!parameters) { // not a valid channel
                changeEmbed(errorEmbed(embedTitle, 'Sorry, but this is not a submission channel.'));
                new Promise(res => setTimeout(res, 10000)).then(() => interaction.deleteReply().catch(e => console.log(e))); // wait 10 secs and delete message
                return false;
            }
            const [minLevel, maxLevel, type] = parameters;
            const items = subjectData.filter(e => e.data.hidden_at == null && e.data.level >= minLevel && e.data.level <= maxLevel && e.object[0].toLowerCase() == type),
                itemsDone = await finder({ level: { $gte: minLevel, $lte: maxLevel }, type: type }).then(data => data.filter(e => e.submissions.length > 0));
            const itemsBoth = itemsDone.filter(e => type == 'r' ? e.submissions.length > 0 : (e.submissions.find(s => s.mnemonictype == 'r') && e.submissions.find(s => s.mnemonictype == 'm')) || e.submissions.find(s => s.mnemonictype == 'b')).map(e => subjectData.find(i => i.id == e.wkId));
            const itemsEither = itemsDone.filter(e => !itemsBoth.find(i => i.id == e.wkId) && e.submissions.find(s => s.mnemonictype == 'm' || s.mnemonictype == 'r')).map(e => subjectData.find(i => i.id == e.wkId));
            const itemsMissing = items.filter(e => !((type == 'r' ? itemsBoth : itemsDone.map(e => subjectData.find(i => i.id == e.wkId))).find(i => i.id == e.id)));
            const arrToList = arr => arr.map(e => e.data.characters || e.data.slug).join(', ');
            const [eitherList, bothList, missingList] = [itemsEither, itemsBoth, itemsMissing].map(e => arrToList(e));
            changeEmbed(simpleEmbed(wkItemColors[type], embedTitle + ` - ${itemNames[type]} from Levels ${minLevel} to ${maxLevel}`, `**Progress:**\n${wholeBar(itemsBoth.length, itemsEither.length + itemsBoth.length, itemsEither.length + itemsMissing.length)}\n\n**Do NOT Have Submissions:**\n${missingList}` + (type != 'r' ? `\n\n**Only Have ONE Mnemonic:**\n${eitherList}` : '') + `\n\n**Completed Items:**\n${bothList}`).setTimestamp());
        } else if (command == 'progress') {
            const subjectData = require('../handlers/wkapiHandler.js').subjectData;
            const type = interaction.options.getString('type'),
                level = interaction.options.getInteger('level');
            
            const dataquery = await errorAwait(logTag, async () => await finder({
                ...(type && { type: type }),
                ...(level && { level: level }),
            }), [], 'Progress -', true);
            if (!dataquery) {
                changeEmbed(errorEmbed(embedTitle, 'Sorry, but there was a database error!'));
                return false;
            }
            const itemsTotal = subjectData.filter(e => (e.data.hidden_at == null) && (type == null || e.object[0].toLowerCase() == type) && (level == null || e.data.level == level)).length,
                submissionAmount = dataquery.map(e => e.submissions.length).reduce((p, c) => p + c, 0),
                itemsCompleted = dataquery.filter(e => (e.type == 'r' && e.submissions.length > 0) || (e.submissions.findIndex(s => s.mnemonictype == 'b') !== -1 || (e.submissions.findIndex(s => s.mnemonictype == 'r') !== -1 && e.submissions.findIndex(s => s.mnemonictype == 'm') !== -1))).length;
            const itemsAll = dataquery.filter(e => e.submissions.length > 0).length;
            const itemsStarted = itemsAll - itemsCompleted;
            changeEmbed(successEmbed(embedTitle + ' - ' + (type != null ? itemNames[type] + (type == 'r' ? 's' : '') : 'Items') + (level != null ? ' of Level ' + level : ''), `${wholeBar(itemsCompleted, itemsAll, itemsTotal)}\n\n` + 'To see these submissions use `/show submissions' + (level != null ? ` level:${level}` : '') + (type != null ? ` type:${itemNames[type]}` : '') + '`.')
                .addFields(
                    { name: 'Items Completed', value: itemsCompleted.toString(), inline: true },
                    ...(type != 'r' ? [{ name: 'Partially Completed', value: itemsStarted.toString(), inline: true }] : []),
                    { name: 'Submissions', value: submissionAmount.toString(), inline: false },
                    ...(type != 'r' ? [{ name: 'Meaning Done', value: dataquery.filter(i => i.submissions.findIndex(e => e.mnemonictype == 'b') != -1 || i.submissions.findIndex(e => e.mnemonictype == 'm') != -1).length.toString(), inline: true }] : []),
                    ...(type != 'r' ? [{ name: 'Reading Done', value: dataquery.filter(i => i.submissions.findIndex(e => e.mnemonictype == 'b') != -1 || i.submissions.findIndex(e => e.mnemonictype == 'r') != -1).length.toString(), inline: true }] : []),
                )
                .setTimestamp());
        } else if (command == 'submissions' || command == 'mysubmissions') {
            const onlyUser = command == 'mysubmissions';
            const char = onlyUser ? null : interaction.options.getString('char'),
                meaning = onlyUser ? null : interaction.options.getString('meaning'),
                type = onlyUser ? null : interaction.options.getString('type'),
                level = onlyUser ? null : interaction.options.getInteger('level'),
                mnemonictype = onlyUser ? null : interaction.options.getString('mnemonictype'),
                user = onlyUser ? interaction.user : interaction.options.getUser('user'),
                accepted = onlyUser ? null : interaction.options.getBoolean('accepted'),
                source = onlyUser ? null : interaction.options.getString('source'),
                subid = onlyUser ? null : interaction.options.getInteger('subid');
            const submissions = await finder({
                ...(char && { char: char }),
                ...(meaning && { meaning: { $regex: meaning, $options: 'i' } }),
                ...(type && { type: type }),
                ...(level && { level: level }),
            }).then(subs => subs.map(item => item.submissions.filter(s => subid != null ? (subid == s.subId) : (s.subId && (mnemonictype == null || s.mnemonictype == mnemonictype) && (user == null || s.user[0] == user.id) && (accepted == null || s.accepted == accepted) && (source == null || s.source == source)))
                .map(s => ({ char: item.char, meaning: item.meaning, type: item.type, level: item.level, ...s }))).flat().sort((a, b) => b.date - a.date)); // newest to oldest
            if (submissions.length == 0) {
                changeEmbed(simpleEmbed(embedColors.neutral, 'Submissions - None Found', 'There are no submissions with the selected properties.'))
                return true;
            }
            var currentSub = 0;
            const updatePages = async (i, edit = false) => {
                const sub = submissions[currentSub];
                const embed = pagesEmbed(embedColors.neutral, 'Submissions - ' + (currentSub + 1) + ' out of ' + submissions.length, `Submitted on ${sub.date.toUTCString()} by ${sub.user[1]}. ${sub.votes != 0 ? 'It has gathered ' + sub.votes + (sub.votes == 1 ? ' vote' : ' votes') + '. ' : ''}The image was uploaded [here](${sub.imagelink}).` + '\n' + itemInfo(sub.char, itemNames[sub.type], sub.level), [
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

            const collector = msg.createMessageComponentCollector({ filter: i => ['fullLeft', 'left', 'random', 'right', 'fullRight'].includes(i.customId), time: activeTime });
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
            collector.on('end', async collected => await errorAwait(logTag, async () => await interaction.deleteReply(), [], `Collector - Terminate with ${collected.size} Button Press(es)`));
        }
        return true;
    }
};