const { discord: { channelIds: { botlogId } } } = require('../../tokens.json');

const log = (namespace, action, status, arg) => `(${namespace}) ${action}${status != undefined ? ' ' + status : ''}${arg != undefined && arg.length != 0 ? ': "' + arg + '"' : ''}`;
var client, botlogChannel;

module.exports = {
    logger(namespace, action, status, arg) {
        const newLog = log(namespace, action, status, arg);
        console.log(newLog);
        if (botlogChannel) botlogChannel.send({ content: newLog });
    },
    async errorAwait(namespace, func, args, name, returnResult = false) {
        var result;
        try {
            result = await func(...args);
        } catch (e) {
            module.exports.logger(namespace, name, 'Failed', args);
            console.error(e);
            return false;
        }
        module.exports.logger(namespace, name, 'Success', args);
        return returnResult ? result : true;
    },
    setClient: async (newClient) => {
        client = newClient;
        botlogChannel = await client.channels.fetch(botlogId);
    }
}