const { botToken } = require('./tokens.json');
const guildId = '1003902017204400278';

const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildIntegrations], partials: ["CHANNEL"] });
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

const prefix = '!';

client.commands = new Collection();

client.on('ready', async () => {
    const guild = client.guilds.cache.get(guildId);
    let commands;
    if (guild) commands = guild.commands;
    else commands = client.application?.commands;
    for (const file of commandFiles) {
        const command = require(`./commands/${file}`);
        commands?.create(command.data);
        client.commands.set(command.data.name, command);
    }
    console.log('The Crabigator is here :)');
    //(await client.channels.fetch('1003902017804177420')).send({ content: 'The Crabigator has arrived.' });
    //require('./artworkSubmitter.js').submitAll(client); // added amandabear mnemonics
});

client.on('messageCreate', async msg => {
    if (!msg.content.startsWith(prefix) || msg.author.bot) return;

    const args = msg.content.slice(prefix.length).split(/ +/);
    const command = args.shift().toLowerCase();

    if (command == 'progress') {
        msg.channel.send('pong');
    } else if (command == 'stop') {
        if (msg.member.roles.cache.some(role => role.name === 'Staff') != undefined) {
            console.log('The Crabigator is not here anymore :(')
            await msg.react('👋');
            (await client.channels.fetch('1003902017804177420')).send({ content: 'The Crabigator has left.' }).then(() => process.exit());
        } else {
            await msg.react('🙅‍');
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