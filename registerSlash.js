const { botToken, clientId, guildId } = require('../tokens.json');

const { REST, Routes } = require('discord.js');

const commands = [
    {
        name: 'show',
        description: 'Shows progress of the project and details about submissions.',
    },
];

const rest = new REST({ version: '10' }).setToken(botToken);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();