const { discord: { botToken, guildId, channelIds: { announceId }, roleIds: { staffId, pickerId } } } = require('../tokens.json');

const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { mongoStartup, mongoShutdown, finder, update } = require('./handlers/mongoHandler.js'); // for startup
const { wkapiStartup } = require('./handlers/wkapiHandler.js'); // for startup
const fs = require('fs'),
    path = require('path');
const { logger, setClient } = require('./helpers/logger.js');
const namespace = 'Main';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildIntegrations], partials: ["CHANNEL"] });
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

// emotes
const { emotes } = require('./helpers/namer.js');
const stringEmotes = async (msg, emoteList) => {
    for (const e of emoteList) {
        const emote = Object.keys(emotes).includes(e) ? emotes[e] : e;
        await msg.react(emote);
    }
}

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
        logger(namespace, `Deleted ${fileNumber} file(s) from "${tempDir}/".`);
    });
}

client.commands = new Collection();

client.on('ready', async () => {
    await setClient(client);
    logger(namespace, 'Startup sequence initialized.');
    emptyTemp();
    // start all handlers
    await Promise.all([
        mongoStartup(),
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
    logger(namespace, 'The Crabigator is here :)\n');
    //(await client.channels.fetch(announceId)).send({ content: 'The Crabigator has arrived.' });
    //require('./artworkSubmitter.js').submitAll(client); // added amandabear mnemonics
});

client.on('messageCreate', async msg => {
    if (!msg.content.startsWith(prefix) || msg.author.bot) return;

    const args = msg.content.slice(prefix.length).split(/ +/);
    const command = args.shift().toLowerCase();
    const replyMsg = async txt => await msg.channel.send({ content: txt, reply: { messageReference: msg.id } });

    if (command == 'wani') {
        logger(namespace, 'Wani - Command', 'Sent', args);
        await replyMsg('kani');
    } else if (command == 'stop') { // stop the bot
        if (msg.member.roles.cache.some(role => role.id === staffId)) {
            logger(namespace, 'Shutdown sequence initialized.')
            await mongoShutdown();
            logger(namespace, 'The Crabigator is not here anymore :(\n');
            await stringEmotes(msg, ['BB', 'Y', 'E']);
            //(await client.channels.fetch(announceId)).send({ content: 'The Crabigator has left.' }).then(() => process.exit());
            process.exit();
        } else {
            await stringEmotes(msg, 'NO');
        }
    } else if (command == 'accept') {
        if (msg.member.roles.cache.some(role => role.id === pickerId || role.id === pickerId)) {
            logger(namespace, 'Accept -', 'Pending', args);
            const wkId = parseInt(args[0]),
                subId = parseInt(args[1]);
            if (!Number.isNaN(wkId) && !Number.isNaN(subId)) {
                const item = (await finder({ wkId: wkId }))[0];
                if (item == undefined) {
                    logger(namespace, 'Accept - Item not Found,', 'Failed');
                    await replyMsg('Could not find item.');
                    return false;
                }
                const currentSub = item.submissions.find(s => s.subId == subId);
                if (currentSub == undefined) {
                    logger(namespace, 'Accept - Submission not Found,', 'Failed');
                    await replyMsg('Could not find submission.');
                    return false;
                }
                const updateArray = Object.fromEntries(item.submissions.map((e, i) => [[`submissions.${i}.accepted`], (e.subId == subId) || (item.type != 'r' && currentSub.mnemonictype != 'b' && e.mnemonictype != 'b' && e.mnemonictype != currentSub.mnemonictype && e.accepted == true) ? true : false ]));
                if (await update({ wkId: wkId }, { $set: updateArray })) {
                    const changed = item.submissions.filter((s, i) => (s.subId != subId) && (s.accepted != Object.values(updateArray)[i])).map(s => s.subId);
                    logger(namespace, 'Accept -', 'Success');
                    await replyMsg(`Accepted submission ${subId} for item ${wkId}.` + (changed.length != 0 ? (changed.length != 1 ? ` Submissions ${changed.join(', ')} were reverted.` : ` Submission ${changed.join(', ')} was unaccepted.`) : ''));
                    return true;
                } else {
                    logger(namespace, 'Accept - Database Update', 'Failed');
                    await replyMsg('Could not update database.');
                    return false;
                }
            } else await replyMsg('Could not parse arguments.');
        } else {
            await stringEmotes(msg, 'NO');
        }
    }
});

client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        // slash commands
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        try {
            await command.execute(interaction);
        } catch (error) {
            logger(namespace, `Execute - ${command}`, 'Failed');
            if (error) console.error(error);
            await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
    }
});

client.login(botToken);