// console logging
const namespace = 'Slash';
const { logger, errorAwait } = require('../helpers/logger.js');

// requires
const { SlashCommandBuilder } = require('@discordjs/builders');
const { submitEmbed, pendingEmbed, errorEmbed } = require('../helpers/embedder.js');

// database
const { append, update, finder } = require('../handlers/mongoHandler.js');

// image uploading
const { uploadImageFromUrl, folderNames, getItemDir } = require('../handlers/bunnyHandler.js');
const imageNaming = (wkid, itype, mtype, subid, name) => encodeURI(`${wkid}_${itype}${mtype}${subid}_${name}-${new Date().toISOString().match(/[a-zA-Z0-9]/g).join('')}`);

// naming schemes
const { itemNames, mnemonicNames } = require('../helpers/namer.js');

// main
module.exports = {
    data: new SlashCommandBuilder()
        .setName('submit')
        .setDescription('Submit an AI mnemonic to the database.')
        .addStringOption(option =>
            option.setName('char')
                .setDescription('Characters of the item (e.g. "大", "大人", or for radicals the meaning "barb").')
                .setRequired(true))
        .addStringOption(option =>
                    option.setName('meaning')
                        .setDescription('Meaning of the item (e.g. "big", "adult", or for radicals the meaning "barb" again).')
                        .setRequired(true))
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Type of the item (radical, kanji, or vocab).')
                .setRequired(true)
                .addChoices(
                    { name: 'Radical', value: 'r' },
                    { name: 'Kanji', value: 'k' },
                    { name: 'Vocab', value: 'v' },))
        /*.addIntegerOption(option =>
                option.setName('level')
                    .setDescription('Level of the item (from 1-60).')
                    .setRequired(true))*/
        .addStringOption(option =>
            option.setName('source')
                .setDescription('The AI used to generate the image (or other possible source).')
                .setRequired(true)
                .addChoices(
                    { name: 'Midjourney (Paid)', value: 'midjourney_paid' },
                    { name: 'Midjourney (Free)', value: 'midjourney_free' },
                    { name: 'DALL-E 2', value: 'dall-e_2' },
                    { name: 'Other AI (Commercial)', value: 'commercial' },
                    { name: 'Other AI (Personal)', value: 'personal' },
                    { name: 'Own Drawing', value: 'drawing' }))
        .addStringOption(option =>
            option.setName('prompt')
                .setDescription('The prompt that was inputted into the AI to generate the image.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('mnemonictype')
                .setDescription('If the image is for the reading or meaning mnemonic (or both).')
                .setRequired(true)
                .addChoices(
                    { name: 'Meaning', value: 'm' },
                    { name: 'Reading', value: 'r' },
                    { name: 'Both', value: 'b' }))
        .addAttachmentOption(option =>
            option.setName('image')
                .setDescription('The generated image.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('remarks')
                .setDescription('Other important details. (Optional)')
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('level')
                .setDescription('The WaniKani level of the item. (Optional)')
                .setRequired(false))
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User that created the image (if left unfilled the user is the submitter). (Optional)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('otheruser')
                .setDescription('User that created the image (used if creator has no discord account). (Optional)')
                .setRequired(false)),
    async execute(interaction) {
        const { subjectData } = require('../handlers/wkapiHandler.js');

        // get values
        const char = interaction.options.getString('char'),
            meaning = interaction.options.getString('meaning'),
            type = interaction.options.getString('type'),
            source = interaction.options.getString('source'),
            prompt = interaction.options.getString('prompt'),
            mnemonictype = interaction.options.getString('mnemonictype'),
            image = interaction.options.getAttachment('image'),
            remarks = interaction.options.getString('remarks'),
            level = interaction.options.getInteger('level'),
            otheruser = interaction.options.getString('otheruser');
        var user = interaction.options.getUser('user');
        user = user != null ? user : interaction.user;

        // embeds
        const embedTitle = 'Submission',
            embedInfo = itemNames[type] + ' ' + char;
        const changeEmbed = async embed => await interaction.editReply({ embeds: [embed] });

        await interaction.reply({ embeds: [pendingEmbed(embedTitle, '[#--] Searching for the item...', embedInfo)] });

        // main submission code
        logger(namespace, `Submit - Initiated by "${(user != null ? user.username : 'Unknown')}"`, 'Pending', new Date());
        const getMeanings = e => e.map(e => e.meaning.toLowerCase());
        const item = subjectData.find(e => (e.object[0].toLowerCase() == type) && (level == null || e.data.level == level) && (type != 'r' ? (e.data.characters == char && getMeanings(e.data.meanings).includes(meaning.toLowerCase())) : (e.data.slug == meaning || e.data.characters == char || getMeanings(e.data.meanings).includes(meaning.toLowerCase()))));
        var newSubmission, submissionPlace;
        if (item == undefined) {
            logger(namespace, `Submit - 1/3 Find Item`, 'Failed');
            await changeEmbed(errorEmbed(embedTitle, 'Sorry, but the requested item could not be found!', embedInfo));
            return false;
        } else {
            logger(namespace, `Submit - 1/3 Find Item`, 'Success');
            await changeEmbed(pendingEmbed(embedTitle, '[##-] Uploading the image...', embedInfo));

            const condition = { wkId: item.id };
            let dbEntry = await finder(condition);
            if (dbEntry.length > 1) logger(namespace, 'WARNING: Multiple database entries for same query found.');
            dbEntry = dbEntry[0];
            submissionPlace = dbEntry != undefined ? dbEntry.submissions.length + 1 : 1;
            const links = await errorAwait(namespace, async (a, b) => await uploadImageFromUrl(a, b, 400), [image.url, folderNames[type] + '/' + imageNaming(item.id, type, mnemonictype, submissionPlace, item.data.characters != null ? item.data.characters : item.data.slug)], 'Submit - 2/3 Upload Image', true);
            if (!links || !links[0]) {
                logger(namespace, 'Submit - 2/3 Upload Image', 'Failed');
                await changeEmbed(errorEmbed(embedTitle, 'Sorry, but the image could not be uploaded!', embedInfo));
                return false;
            } else await changeEmbed(pendingEmbed(embedTitle, '[###] Saving submission to the database...', embedInfo));
            const [imagelink, thumblink] = links;
            var subId = submissionPlace;
            if (dbEntry) while (dbEntry.submissions.find(s => s.subId == subId)) subId--;
            newSubmission = {
                "subId": subId,
                "date": new Date(),
                "user": otheruser != null ? [null, otheruser] : (user != null ? [user.id, user.username + "#" + user.discriminator] : [null, null]),
                "imagelink": imagelink,
                "thumblink": thumblink,
                "mnemonictype": mnemonictype,
                "source": source,
                "prompt": prompt,
                "remarks": remarks != null ? remarks : "",
                "accepted": false,
                "votes": 0,
            };
            let func;
            if (dbEntry != undefined) {
                func = async () => await update(condition, { $push: { submissions: newSubmission } });
            } else {
                dbEntry = {
                    "wkId": item.id,
                    "char": item.data.slug,
                    "meaning": item.data.meanings[0].meaning,
                    "type": type,
                    "level": item.data.level,
                    "submissions": [newSubmission],
                }
                func = async () => await append(dbEntry);
            }
            if (!(await func())) {
                logger(namespace, 'Submit - 3/3 Save To Database', 'Failed');
                await changeEmbed(errorEmbed(embedTitle, 'Sorry, but there was a database error!', embedInfo));
                return false;
            }
            logger(namespace, 'Submit - 3/3 Save To Database', 'Success');
        }
        logger(namespace, `Submit - Initiated by "${(user != null ? user.username : 'Unknown')}"`, 'Success', new Date());

        // final response
        const response = String(`*${newSubmission.user[1]}* made a submission for the *${mnemonicNames[mnemonictype]} mnemonic* of a level ${item.data.level} ${itemNames[type]}.\n\n**Item:**\n${item.data.characters != null ? item.data.characters : item.data.slug} (${item.data.meanings[0].meaning})\nFor more info on this item use ${'`'}/mnemonic name:${item.data.slug} type:${itemNames[type]} level:${item.data.level}${'`'}.\n\n**Submission:**\nThis submission was submitted as the ${submissionPlace}. one for this item.\nThe prompt was "${newSubmission.prompt}"${newSubmission.remarks != '' ? ' with a remark of "' + newSubmission.remarks + '"' : ''}.\n\n**Image:**\nThe image was uploaded [here](${newSubmission.imagelink}).`);
        await changeEmbed(submitEmbed(embedTitle, response, newSubmission.thumblink, embedInfo));
        return true;
    }
};