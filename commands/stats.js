// console logging
const logTag = 'Slash';
const { logger } = require('../helpers/logger.js');

// requires
const { SlashCommandBuilder } = require('@discordjs/builders');
const { pendingEmbed, embedBuilder, successEmbed, errorEmbed } = require('../helpers/embedder.js');
const { embedColors } = require('../helpers/styler.js');

const { getUserInfo } = require('../handlers/wkapiHandler.js');
const { append, update, finder } = require('../handlers/mongoHandler.js');

const mongoColName = 'wkUserInfo';

const updateUserInfo = async (embedTitle, embedInfo, apiv2key, dbEntry, userData = false) => {
    var returnData = false;
    if (!userData) {
        userData = await getUserInfo(apiv2key);
        returnData = true;
    }
    if (userData.code) {
        logger(logTag, 'Stats - Update', 'Failed', `${userData.code}: ${userData.error}`);
        return false;
    }
    var updateArray = { lastupdate: new Date(), userdata: userData };
    var embed;
    if (dbEntry.apiv2key === apiv2key) {
        logger(logTag, 'Stats - Register', 'Unchanged');
        embed = successEmbed(embedTitle, `Your WaniKani APIv2 key is already stored: *${dbEntry.apiv2key}*.`);
    } else { // change key
        logger(logTag, 'Stats - Register', 'Updated');
        embed = successEmbed(embedTitle, `Changed your saved WaniKani APIv2 key from *${dbEntry.apiv2key}* to *${apiv2key}*.`, embedInfo);
        updateArray.apiv2key = apiv2key;
    }
    update({ userId: dbEntry.userId }, { $set: updateArray }, mongoColName);
    return returnData ? userData : embed;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Your statistics regarding this project and WaniKani.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('register')
                .setDescription('Connect to your WaniKani account using your API key.')
                .addStringOption(option =>
                    option.setName('apiv2key')
                        .setDescription('Your WaniKani APIv2 key.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('show')
                .setDescription('Show project and WaniKani statistics.')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user whose statistics you want to see.')
                        .setRequired(false))
                .addBooleanOption(option =>
                    option.setName('ephemeral')
                        .setDescription('If others should see this message.')
                        .setRequired(false))),
    async execute(interaction) {
        logger(logTag, `Stats - Initiated by "${(interaction.user != undefined ? interaction.user.username : 'Unknown')}"`, 'Sent', new Date());

        const command = interaction.options.getSubcommand();
        const user = (command == 'show' ? interaction.options.getUser('user') : null) || interaction.user;
        const dbEntry = await finder({ userId: user.id }, mongoColName);
        const ephemeral = !!(command == 'show' ? interaction.options.getBoolean('ephemeral') : true);
        const member = interaction.member;

        if (dbEntry.length > 1) logger(logTag, `WARNING: Multiple WaniKani user entries found for ${user.id} (${user.username}).`);

        const embedTitle = 'Stats';
        var embedInfo = command == 'register' ? 'Register' : (member.displayName || 'Unknown');
        const changeEmbed = async embed => await interaction.editReply({ embeds: [embed] });

        await interaction.reply({ embeds: [pendingEmbed(embedTitle, 'Processing the request...', embedInfo)], ephemeral: ephemeral });

        if (command == 'register') {
            const apiv2key = interaction.options.getString('apiv2key').toLowerCase().match(/[a-z0-9-]*/g).join('');

            const userData = await getUserInfo(apiv2key);

            if (!userData.code || userData.code == 200) { // user data get success -> api key validated
                if (dbEntry.length > 0) { // already registered
                    changeEmbed(await updateUserInfo(embedTitle, embedInfo, apiv2key, dbEntry[0], userData));
                    return true;
                }

                // new register
                logger(logTag, 'Stats - Register', 'Success');
                append({ userId: user.id, apiv2key: apiv2key, lastupdate: new Date(), userdata: userData }, mongoColName)
                    .then(() => changeEmbed(successEmbed(embedTitle, 'Registration successful!', embedInfo)));
            } else { // user rejected
                logger(logTag, 'Stats - Register', 'Failed', `${userData.code}: ${userData.error}`);
                changeEmbed(errorEmbed(embedTitle, `API gave a response of ${userData.code}. Registrastion failed.`, embedInfo));
            }
        } else if (command == 'show') {
            var statEmbed = embedBuilder();

            const dateFormat = date => date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

            const submissions = await finder({ 'submissions.user.0': user.id }).then(data => data.map(e => e.submissions).flat().filter(s => s.user[0] == user.id));
            const color = await user.fetch(true).then(u => u.hexAccentColor);
            statEmbed = statEmbed.setColor(color ? parseInt('0x' + color.slice(1)) : embedColors.neutral)
                .setThumbnail(user.displayAvatarURL())
                .addFields( // member data
                    { name: 'Joined Project', value: dateFormat(member.joinedAt), inline: true },
                    { name: 'Submissions', value: `__${submissions.length.toString()}__`, inline: true },
                );

            if (dbEntry.length > 0) { // is registerd
                const data = dbEntry[0];
                var userData = data.userdata; // update when data is older than a day
                if (new Date() - data.lastupdate > 1000) userData = await updateUserInfo(embedTitle, embedInfo, data.apiv2key, data);
                if (!userData) {
                    changeEmbed(errorEmbed(embedTitle, 'Data could not be updated.', embedInfo));
                    return false;
                }
                statEmbed = statEmbed.addFields( // wanikani data
                    { name: '\u200B', value: '**WaniKani Stats**', inline: false },
                    { name: 'Name', value: `[${userData.username}](${userData.profile_url})`, inline: true },
                    { name: 'Level', value: `*${userData.level.toString()}*`, inline: true },
                    { name: 'Started', value: dateFormat(new Date(userData.started_at)), inline: true },
                    { name: 'Subbed', value: userData.subscription.active ? 'Yes' : 'No', inline: true },
                );
            } else { // unregistered
                embedInfo += ' (Unregistered)';
                statEmbed = statEmbed.setFooter({ text: 'WaniKani account not registered.' })
            }
            statEmbed = statEmbed.setTitle(embedTitle + ' - ' + embedInfo);

            changeEmbed(statEmbed);
        }
        return true;
    }
};