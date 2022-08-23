// console logging
const logTag = 'Slash';
const { logger, errorAwait } = require('../helpers/logger.js');

// requires
const { SlashCommandBuilder } = require('@discordjs/builders');
const { submitEmbed, pendingEmbed, errorEmbed } = require('../helpers/embedder.js');
const { itemInfo } = require('../helpers/messager.js');
const { md5EncryptHex } = require('../helpers/misc.js');
const { discord: { roleIds: { submitterId } } } = require('../../tokens.json');
const axios = require('axios');

// database
const { append, update, finder } = require('../handlers/mongoHandler.js');

// image uploading
const { uploadImage, deleteImage, folderNames, purgeUrl, simpleUploadImage } = require('../handlers/bunnyHandler.js');
const imageNaming = (wkid, itype, mtype, subid, name) => encodeURI(`${wkid}_${itype}${mtype}${subid}_${name}-${new Date().toISOString().match(/[a-zA-Z0-9]/g).join('')}`);

// naming schemes
const { itemNames, mnemonicNames } = require('../helpers/namer.js');

const getBuffer = async url => await errorAwait(logTag, async url => {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        return Buffer.from(response.data, 'utf-8');
    }, [url], `Buffer - From Url`, true);

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
                    { name: 'DreamStudio', value: 'dream'},
                    { name: 'DALL-E 2', value: 'dall-e_2' },
                    { name: 'Craiyon', value: 'craiyon' },
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
        logger(logTag, `Submit - Initiated by "${(user != null ? user.username : 'Unknown')}"`, 'Pending', new Date());
        const item = subjectData.find(e => (e.object[0].toLowerCase() == type) && (level == null || e.data.level == level) && (e.data.slug == char || e.data.characters == char));
        var newSubmission, submissionPlace;
        if (item == undefined) {
            logger(logTag, `Submit - 1/3 Find Item`, 'Failed');
            changeEmbed(errorEmbed(embedTitle, 'Sorry, but the requested item could not be found!', embedInfo));
            return false;
        } else if (item.data.hidden_at !== null) {
            logger(logTag, `Submit - 1/3 Find Item`, 'Hidden');
            changeEmbed(errorEmbed(embedTitle, 'Sorry, but the requested item is hidden!', embedInfo));
            return false;
        } else {
            logger(logTag, `Submit - 1/3 Find Item`, 'Success');
            await changeEmbed(pendingEmbed(embedTitle, '[##-] Uploading the image...', embedInfo));

            const condition = { wkId: item.id };
            let dbEntry = await finder(condition);
            if (dbEntry.length > 1) logger(logTag, 'WARNING: Multiple database entries for same query found.');
            dbEntry = dbEntry[0];
            submissionPlace = dbEntry != undefined ? dbEntry.submissions.length + 1 : 1;
            const buffer = await getBuffer(image.url);
            const hash = md5EncryptHex(buffer);
            if (dbEntry) { // hash, search for duplicates
                const duplicates = dbEntry.submissions.filter(s => s.md5imghash == hash);
                if (duplicates.length > 0) {
                    await changeEmbed(errorEmbed(embedTitle, `This image seems to be a duplicate of submission ${duplicates.map(d => d.subId).join(', ')}.\n`
                        + `To see that submission use ${'`'}/show submissions char:${dbEntry.char} type:${itemNames[dbEntry.type]} subid:${duplicates[0].subId}${'`'}.\n\n`
                        + 'If you think this is incorrect or you wanted to change your submission *please contact a staff member*.', embedInfo));
                    logger(logTag, 'Submit - 2/3 Upload Image (Duplicate)', 'Failed');
                    return false;
                }
            }
            const links = await errorAwait(logTag, async path => await uploadImage(buffer, path, 512), [folderNames[type] + '/' + imageNaming(item.id, type, mnemonictype, submissionPlace, item.data.characters != null ? item.data.characters : item.data.slug)], 'Submit - 2/3 Upload Image', true);
            if (!links || !links[0]) {
                logger(logTag, 'Submit - 2/3 Upload Image', 'Failed');
                await changeEmbed(errorEmbed(embedTitle, 'Sorry, but the image could not be uploaded!', embedInfo));
                return false;
            } else await changeEmbed(pendingEmbed(embedTitle, '[###] Saving submission to the database...', embedInfo));
            const [imagelink, thumblink] = links;
            var subId = dbEntry && dbEntry.submissions.length > 0 ? Math.max(...dbEntry.submissions.map(e => e.subId)) + 1 : 1;
            if (dbEntry) while (dbEntry.submissions.find(s => s.subId == subId)) subId++;
            const newMnemonictype = type == 'r' ? 'm' : mnemonictype;
            newSubmission = {
                "subId": subId,
                "date": new Date(),
                "user": otheruser != null ? [null, otheruser] : (user != null ? [user.id, user.username + "#" + user.discriminator] : [null, null]),
                "imagelink": imagelink,
                "thumblink": thumblink,
                "md5imghash": hash,
                "mnemonictype": newMnemonictype,
                "source": source,
                "prompt": prompt,
                "remarks": remarks != null ? remarks : "",
                "accepted": false,
                "votes": 0,
            };
            let func;
            if (dbEntry != undefined) {
                func = async () => await update(condition, { $push: { submissions: newSubmission } });
                if (submissionPlace == 1 || (newMnemonictype != 'b' && !dbEntry.submissions.find(s => newMnemonictype == s.mnemonictype))) await module.exports.imageAcceptUpload(imagelink, thumblink, item.id, type, newMnemonictype);
            } else {
                dbEntry = {
                    "wkId": item.id,
                    "char": item.data.characters || item.data.slug,
                    "meaning": item.data.meanings[0].meaning,
                    "type": type,
                    "level": item.data.level,
                    "submissions": [newSubmission],
                }
                func = async () => await append(dbEntry);
                await module.exports.imageAcceptUpload(imagelink, thumblink, item.id, type, newMnemonictype);
            }
            if (!(await func())) {
                logger(logTag, 'Submit - 3/3 Save To Database', 'Failed');
                await changeEmbed(errorEmbed(embedTitle, 'Sorry, but there was a database error!', embedInfo));
                return false;
            }
            logger(logTag, 'Submit - 3/3 Save To Database', 'Success');
        }
        logger(logTag, `Submit - Initiated by "${(user != null ? user.username : 'Unknown')}"`, 'Success', new Date());

        // add submitter role if member does not already have it
        const member = interaction.member;
        if (!member.roles.cache.some(role => role.id == submitterId)) member.roles.add(submitterId).then(() => member.send(`Congrats ${member.displayName}🥳!\n\nYou just submitted your first image, way to go! We gave you the *Submitter* role so that everyone knows you're one of the chosen ones. Keep on submitting those mnemonic images!\n\nWell then, see you around 😉`));

        // final response
        const response = String(`*${newSubmission.user[1]}* made a submission for the *${mnemonicNames[mnemonictype]} mnemonic* of a level ${item.data.level} ${itemNames[type]}.\n\n`
            + `**Item:**\n[${item.data.characters != null ? item.data.characters : item.data.slug} (${item.data.meanings[0].meaning})](${item.data.document_url})\n${itemInfo(item.data.slug, itemNames[type], item.data.level)}\n\n`
            + `**Submission:**\nSubmission Place: ${submissionPlace}\n\n`
            + `Prompt:${('\n' + newSubmission.prompt).replaceAll('\n', '\n> ')}${newSubmission.remarks != '' ? '\n\nRemark:' + ('\n' + newSubmission.remarks).replaceAll('\n', '\n> ') : ''}\n\n**Image:**\nThe image was uploaded [here](${newSubmission.imagelink}).`);
        changeEmbed(submitEmbed(embedTitle, response, newSubmission.thumblink, embedInfo));
        return true;
    },
    async imageAcceptUpload(imageUrl, thumbUrl, wkId, itemtype, mnemonictype) {
        const types = mnemonictype == 'b' ? ['r', 'm'] : [mnemonictype];
        const typeNames = {
            r: 'Reading',
            m: 'Meaning',
        }
        for (const type of types) {
            for (const [ext, url] of [['.png', imageUrl], ['-thumb.jpg', thumbUrl]]) {
                const path = folderNames[itemtype] + '/' + typeNames[type] + '/' + wkId + ext;
                const deleted = await deleteImage(path);
                if (deleted) await purgeUrl(path);
                logger(logTag, 'Accept - Delete Image', 'Sent', !deleted ? 'Nothing to delete' : 'Deleted');
                logger(logTag, 'Accept - Upload Image', 'Sent', [await simpleUploadImage(await getBuffer(url), path), path]);
            }
        }
    },
    async updateHashes() {
        //await require('../handlers/mongoHandler.js').mongoStartup();
        logger(logTag, 'Hash - Update All', 'Sent');
        const db = await finder({});
        for (const item of db) {
            const updateArray = Object.fromEntries(await Promise.all(item.submissions.map(sub => sub.imagelink ? getBuffer(sub.imagelink) : false))
                .then(async buffers => buffers.map((b, i) => b ? [`submissions.${i}.md5imghash`, md5EncryptHex(b)] : false).filter(i => i)));
            console.log(updateArray);
            await update({ wkId: item.wkId }, { $set: updateArray });
        }
    },
    /*async updateAll() {
        await require('../handlers/mongoHandler.js').mongoStartup();
        const items = await finder({});
        console.log(items)
        for (const item of items) {
            const upload = (sub) => module.exports.imageAcceptUpload(sub.imagelink, sub.thumblink, item.wkId, item.type, sub.mnemonictype);
            for (const sub of item.submissions) {
                console.log(sub)
                upload(sub);
                console.log(sub.thumblink, sub.imagelink)
            }
            for (const sub of item.submissions.filter(s => s.accepted)) upload(sub);
        }
    }*/
};