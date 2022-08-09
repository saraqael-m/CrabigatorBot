const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
var pendingSubmissions = 0;

const itemNames = {
    r: 'Radical',
    k: 'Kanji',
    v: 'Vocab',
};

const mnemonicNames = {
    m: 'meaning',
    r: 'reading',
    b: 'reading and meaning',
};

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
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User that created the image (if left unfilled the user is the submitter). (Optional)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('otheruser')
                .setDescription('User that created the image (used if creator has no discord account). (Optional)')
                .setRequired(false)),
    async execute(interaction) {
        pendingSubmissions++;
        while (pending)
        const submit = require('../DBhandler.js').submit;

        const char = interaction.options.getString('char'),
            meaning = interaction.options.getString('meaning'),
            type = interaction.options.getString('type'),
            source = interaction.options.getString('source'),
            prompt = interaction.options.getString('prompt'),
            mnemonictype = interaction.options.getString('mnemonictype'),
            image = interaction.options.getAttachment('image'),
            remarks = interaction.options.getString('remarks'),
            user = interaction.options.getUser('user'),
            otheruser = interaction.options.getString('otheruser');

        const sendEmbed = new EmbedBuilder()
            .setColor(0xe8c227)
            .setTitle('Submission - ' + itemNames[type] + ' ' + char)
            .setDescription('**Pending:** Sending the submission...');
        await interaction.reply({ embeds: [sendEmbed] });

        const [newSubmission, item, submissionPlace] = await submit(char, meaning, type, source, prompt, mnemonictype, image.url, remarks, user != null ? user : interaction.user, otheruser);
        
        if (newSubmission == undefined) {
            var errorEmbed = new EmbedBuilder()
                .setColor(0xe83427)
                .setTitle('Submission - ' + itemNames[type] + ' ' + item.char);
            switch (item) {
                case 'not_found':
                    errorEmbed.setDescription('**Error:** Sorry, but the requested item could not be found!');
                    break;
                case 'database_error':
                    errorEmbed.setDescription('**Error:** Sorry, but there was a database error!');
                    break;
                case 'image_upload_error':
                    errorEmbed.setDescription('**Error:** Sorry, but the image could not be uploaded!');
                    break;
                default:
                    errorEmbed.setDescription('**Error:** Sorry, but an unknown error occured!');
                    break;
            }
            await interaction.editReply({ embeds: [errorEmbed] });
            return;
        }
            
        const response = String(`*${newSubmission.user[1]}* made a submission for the **${mnemonicNames[mnemonictype]} mnemonic** of a level ${item.level} ${itemNames[type]}:\n\n **${item.char}** (${item.meaning})\nIt was successfully submitted as submission ${submissionPlace}!\n\nThe prompt was "${newSubmission.prompt}"${newSubmission.remarks != '' ? ' with a remark of "' + newSubmission.remarks + '"' : ''}.\n\nHere is the [image](${newSubmission.link}):`);
        const doneEmbed = new EmbedBuilder()
            .setColor(0x08c92c)
            .setTitle('Submission - ' + itemNames[type] + ' ' + item.char)
            .setDescription(response)
            .setImage(newSubmission.link)
            .setTimestamp();
        await interaction.editReply({ embeds: [doneEmbed] });
    }
};