const { discord: { botToken, guildId, channelIds: { announceId }, roleIds: { staffId, pickerId } } } = require('../tokens.json');

const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { mongoStartup, mongoShutdown, finder, update } = require('./handlers/mongoHandler.js'); // for startup
const { wkapiStartup } = require('./handlers/wkapiHandler.js'); // for startup
const fs = require('fs'),
    path = require('path');
const { imageAcceptUpload } = require('./commands/submit.js');
const { logger, loggerSetClient } = require('./helpers/logger.js'),
    { voterSetClient, createElection, electionShutdown, insertElection } = require('./itemVotes.js');
const logTag = 'Main';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers, // get guild member join event
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages, // send welcome message
        GatewayIntentBits.GuildMessageReactions, // reactions poll (item voting)
    ],
    partials: ["CHANNEL"]
});
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

// emotes
const { stringEmotes } = require('./helpers/messager.js');

// bot command prefix
const prefix = 'wk!';

// empty temp folder
const tempDir = 'temp';
const emptyTemp = () => {
    fs.readdir(tempDir, (err, files) => {
        if (err) throw err;
        const fileNumber = files.length;
        for (const file of files) {
            fs.unlink(path.join(tempDir, file), err => {
                if (err) throw err;
            });
        }
        logger(logTag, `Deleted ${fileNumber} file(s) from "${tempDir}/".`);
    });
}

client.commands = new Collection();

client.on('ready', async () => {
    await loggerSetClient(client).then(async () => await voterSetClient(client));
    logger(logTag, 'Startup sequence initialized.');
    emptyTemp();
    // start all handlers
    await Promise.all([
        mongoStartup().then(async () => await Promise.all([
            await createElection('r'),
            await createElection('k'),
            await createElection('v'),
        ])),
        wkapiStartup()
    ]);
    // get commands ready
    const guild = client.guilds.cache.get(guildId);
    let commands;
    if (guild) commands = guild.commands;
    else commands = client.application?.commands;
    for (const file of commandFiles) {
        const command = require(`./commands/${file}`);
        commands?.create(command.data);
        client.commands.set(command.data.name, command);
    }
    // announce arrival
    logger(logTag, 'The Crabigator is here :)\n');
    (await client.channels.fetch(announceId)).send({ content: 'The Crabigator has arrived.' });
    //require('./artworkSubmitter.js').submitAll(client); // added amandabear mnemonics
});

client.on('messageCreate', async msg => {
    if (msg.author.bot) return;

    if (msg.content.toLowerCase() == 'wani') stringEmotes(msg, 'KANI');

    if (!msg.content.startsWith(prefix)) return;

    const args = msg.content.slice(prefix.length).split(/ +/);
    const command = args.shift().toLowerCase();
    const replyMsg = async txt => await msg.channel.send({ content: txt, reply: { messageReference: msg.id } });

    if (command == 'stop') { // stop the bot
        if (msg.member.roles.cache.some(role => role.id === staffId)) {
            logger(logTag, 'Shutdown sequence initialized.')
            await electionShutdown()
                .then(async () => await mongoShutdown());
            logger(logTag, 'The Crabigator is not here anymore :(\n');
            await stringEmotes(msg, ['BB', 'Y', 'E']);
            (await client.channels.fetch(announceId)).send({ content: 'The Crabigator has left.' }).then(() => process.exit());
        } else {
            stringEmotes(msg, 'NO');
        }
    } else if (command == 'accept' || command == 'unaccept') { // accept/unaccept submissions
        const isUnaccept = command == 'unaccept',
            name = command.charAt(0).toUpperCase() + command.slice(1);
        if (msg.member.roles.cache.some(role => role.id === staffId || role.id === pickerId)) {
            logger(logTag, name + ' -', 'Pending', args);
            const wkId = parseInt(args[0]),
                subId = parseInt(args[1]);
            if (!Number.isNaN(wkId) && !Number.isNaN(subId)) {
                const item = (await finder({ wkId: wkId }))[0];
                if (item == undefined) {
                    logger(logTag, name + ' - Item not Found,', 'Failed');
                    await replyMsg('Could not find item.');
                    return false;
                }
                const currentSub = item.submissions.find(s => s.subId == subId);
                if (currentSub == undefined) {
                    logger(logTag, name + ' - Submission not Found,', 'Failed');
                    await replyMsg('Could not find submission.');
                    return false;
                }
                const updateArray = isUnaccept ? Object.fromEntries([[`submissions.${item.submissions.findIndex(s => s.subId == subId)}.accepted`, false]]) : Object.fromEntries(item.submissions.map((e, i) => [[`submissions.${i}.accepted`], (e.subId == subId) || (item.type != 'r' && currentSub.mnemonictype != 'b' && e.mnemonictype != 'b' && e.mnemonictype != currentSub.mnemonictype && e.accepted == true) ? true : false]));
                if (await update({ wkId: wkId }, { $set: updateArray })) {
                    const changed = isUnaccept ? [] : item.submissions.filter((s, i) => (s.subId != subId) && (s.accepted != Object.values(updateArray)[i])).map(s => s.subId);
                    logger(logTag, name + ' -', 'Success');
                    await replyMsg(name + `ed submission ${subId} for item ${wkId}.` + (changed.length != 0 ? (changed.length != 1 ? ` Submissions ${changed.join(', ')} were reverted.` : ` Submission ${changed.join(', ')} was unaccepted.`) : ''));
                    if (!isUnaccept) await imageAcceptUpload(currentSub.imagelink, wkId, item.type, currentSub.mnemonictype);
                    return true;
                } else {
                    logger(logTag, name + ' - Database Update', 'Failed');
                    await replyMsg('Could not update database.');
                    return false;
                }
            } else await replyMsg('Could not parse arguments.');
        } else {
            stringEmotes(msg, 'NO');
        }
    } else if (command == 'votes') { // show votes for submissions of item
        logger(logTag, 'Votes -', 'Pending');
        const wkId = parseInt(args[0]);
        if (!Number.isNaN(wkId)) {
            const item = (await finder({ wkId: wkId }))[0];
            if (item == undefined) {
                logger(logTag, 'Votes - Item not Found,', 'Failed');
                await replyMsg('Could not find item.');
                return false;
            }
            await replyMsg(`**Votes for ${wkId}:**\n` + '```' + item.submissions.map(s => `\tSubmission ${s.subId} (${s.mnemonictype}): ${s.votes} vote(s)`).join('\n') + '```');
            logger(logTag, 'Votes -', 'Success');
            return true;
        } else await replyMsg('Could not parse argument.');
    } else if (command == 'elect') { // change next election
        logger(logTag, 'Elect -', 'Pending');
        if (msg.member.roles.cache.some(role => role.id === staffId)) {
            const type = args[0],
                pair = JSON.parse(args.slice(1).join(' '));
            insertElection(type, pair);
            stringEmotes(msg, 'OKAY');
        } else stringEmotes(msg, 'NO');
    } else if (command == 'delete') { // delete a submission
        logger(logTag, 'Delete -', 'Pending');
        if (msg.member.roles.cache.some(role => role.id === staffId)) {
            const wkId = parseInt(args[0]),
                subId = parseInt(args[1]);
            if (!Number.isNaN(wkId) && !Number.isNaN(subId)) {
                if (await update({ wkId: wkId }, { $pull: { submissions: { subId: { $eq: subId } } } })) stringEmotes(msg, 'DONE');
                else stringEmotes(msg, 'FAIL');
            } else await replyMsg('Could not parse arguments.');
        } else stringEmotes(msg, 'NO');
    }
});

client.on('guildMemberAdd', async member => {
    // member welcome message
    logger(logTag, `User Joined - ${member.tag}`);
    const msg = await member.send(
`Hi 👋 Thank you for joining the WaniKani Image Mnemonics project. We're happy to have you here 😄 

First of all, what is this project about? Well, mnemonics are a kind of memory aid in form of a little story containing multiple elements to help you remember them more easily. And https://wanikani.com/ uses these to help you get the reading and meaning of Japanese kanji, vocabulary, and radicals engrained into your head. Although this works very well in its written form, using multiple senses to remember things helps you to recall them more quickly and reliably later. 

That's where this project comes into play! Our aim is to create images corresponding to the mnemonics for the over 9000 items taught on WaniKani. To do that we started creating AI generated images because it's fast and can produce really good results (also you can start doing it for free)! But other artistic forms are also accepted, e.g. if you want to draw something or edit an image together that's very welcome 👍

For more info visit the "getting-started" channel on the server. 

Well then, I have to go now, but I hope to receive a submission from you one of these days. And if you have any questions feel free to ask users with the *Staff* role! 😉`
    );
    msg.suppressEmbeds(true);
});

client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        // slash commands
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        try {
            await command.execute(interaction);
        } catch (error) {
            logger(logTag, `Execute - ${command}`, 'Failed');
            if (error) console.error(error);
            await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
    }
});

client.login(botToken);