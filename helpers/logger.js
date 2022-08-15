const { discord: { channelIds: { botlogId } } } = require('../../tokens.json');

const log = (logTag, action, status, arg) => `(${logTag}) ${action}${status != undefined ? ' ' + status : ''}${arg != undefined && arg.length != 0 ? ': "' + arg + '"' : ''}`;
var client, botlogChannel;

module.exports = {
    logger(logTag, action, status, arg) {
        const newLog = log(logTag, action, status, arg);
        console.log(newLog);
        if (botlogChannel) botlogChannel.send({ content: newLog });
    },
    async errorAwait(logTag, func, args, name, returnResult = false) {
        var result;
        try {
            result = await func(...args);
        } catch (e) {
            module.exports.logger(logTag, name, 'Failed', args);
            console.error(e);
            return false;
        }
        module.exports.logger(logTag, name, 'Success', args);
        return returnResult ? result : true;
    },
    loggerSetClient: async (newClient) => {
        client = newClient;
        botlogChannel = await client.channels.fetch(botlogId);
    }
}