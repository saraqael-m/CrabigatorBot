const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages], partials: ["CHANNEL"] });

const prefix = '!';

client.on('ready', () => console.log('The Crabigator is here.'));

client.on('messageCreate', async msg => {
    console.log(msg.content);
    if (!msg.content.startsWith(prefix) || msg.author.bot) return;

    const args = msg.content.slice(prefix.length).split(/ +/);
    const command = args.shift().toLowerCase();

    if (command == 'test') {
        console.log('test');
        msg.channel.send('test');
    }
});

client.on('interactionCreate', async interaction => {
    console.log(interaction);
    if (!interaction.isChatInputCommand()) return;
});

client.login('MTAwNDMwMjE0NzIwNDE3MzkwNA.GjQC0P.TAbwNEocBfeDMoqY-7XZtyC1khUrUj9FBMCeZA');