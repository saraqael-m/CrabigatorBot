const logger = (namespace, action, status, arg) => console.log(`(${namespace}) ${action} ${status}${arg != undefined && arg.length != 0 ? ': "' + arg + '"' : ''}`);

module.exports = {
    logger(namespace, action, status, arg) { logger(namespace, action, status, arg); },
    async errorAwait(namespace, func, args, name, returnResult = false) {
        var result;
        try {
            result = await func(...args);
        } catch (e) {
            logger(namespace, name, 'Failed', args);
            console.error(e);
            return false;
        }
        logger(namespace, name, 'Success', args);
        return returnResult ? result : true;
    },
    namespace: ''
}