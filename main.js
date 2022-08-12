const { discord: { botToken, guildId, channelIds: { announceId } } } = require('../tokens.json');

const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { mongoShutdown } = require('./handlers/mongoHandler.js');
//const { subjectData } = require('./handlers/wkapiHandler.js'); // for startup
const fs = require('fs'),
    path = require('path');

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
const prefix = '!';

// empty temp folder
const tempDir = 'temp';
fs.readdir(tempDir, (err, files) => {
    if (err) throw err;
    const fileNumber = files.length;
    for (const file of files) {
        fs.unlink(path.join(tempDir, file), err => {
            if (err) throw err;
        });
    }
    console.log(`Deleted ${fileNumber} file(s) from "${tempDir}/".`);
});

client.commands = new Collection();

client.on('ready', async () => {
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
    console.log('The Crabigator is here :)\n');
    //(await client.channels.fetch(announceId)).send({ content: 'The Crabigator has arrived.' });
    //require('./artworkSubmitter.js').submitAll(client); // added amandabear mnemonics
});

client.on('messageCreate', async msg => {
    if (!msg.content.startsWith(prefix) || msg.author.bot) return;

    const args = msg.content.slice(prefix.length).split(/ +/);
    const command = args.shift().toLowerCase();

    if (command == 'progress') {
        msg.channel.send('pong');
    } else if (command == 'stop') { // stop the bot
        if (msg.member.roles.cache.some(role => role.name === 'Staff')) {
            console.log('\nShutdown sequence initialized.')
            await mongoShutdown();
            console.log('The Crabigator is not here anymore :(');
            await stringEmotes(msg, ['BB', 'Y', 'E']);//msg.react(emotes.BB).then(async () => await msg.react(emotes.Y)).then(async () => await msg.react(emotes.E));
            //(await client.channels.fetch(announceId)).send({ content: 'The Crabigator has left.' }).then(() => process.exit());
            process.exit();
        } else {
            await msg.react(emotes.N).then(async () => await msg.react(emotes.O));
        }
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
        await command.execute(interaction);
    } catch (error) {
        if (error) console.error(error);
        await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
    }
});

client.login(botToken);