// console logging
const logTag = 'Mongo';
const { errorAwait } = require('../helpers/logger.js');

// database connection
const { mongoDB: { mongoUsername, mongoPassword, mongoName } } = require('../../tokens.json');
const { MongoClient, ServerApiVersion } = require('mongodb');
const connectionString = `mongodb+srv://${mongoUsername}:${mongoPassword}@cluster0.acrkbmu.mongodb.net/wk-mnemonic-images`;
const client = new MongoClient(connectionString, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

var collections = {
    submissions: undefined,
    wkUserInfo: undefined,
};

// main database functions
module.exports = {
    async append(item, col = 'submissions') { return await errorAwait(logTag, async a => await collections[col].insertOne(a), [item], 'Append - Single', true); },
    async remove(cond, col = 'submissions') { return await errorAwait(logTag, async a => await collections[col].deleteOne(a), [cond], 'Remove - Single', true); },
    async update(cond, item, col = 'submissions') { return await errorAwait(logTag, async (a, b) => await collections[col].updateOne(a, b), [cond, item], 'Update - Single', true); },
    async appmul(item, col = 'submissions') { return await errorAwait(logTag, async a => await collections[col].insertMany(a), [item], 'Append - Multiple', true); },
    async remmul(cond, col = 'submissions') { return await errorAwait(logTag, async a => await collections[col].deleteMany(a), [cond], 'Remove - Multiple', true); },
    async updmul(cond, item, col = 'submissions') { return await errorAwait(logTag, async (a, b) => await collections[col].updateMany(a, b), [cond, item], 'Update - Multiple', true); },
    async finder(cond, col = 'submissions') { return await errorAwait(logTag, async a => await collections[col].find(a).toArray(), [cond], 'Find -', true); },
    async mongoShutdown() { // shutdown (not necessary)
        return await errorAwait(logTag, async () => await client.close(), [], 'Shutdown -');
    },
    async mongoStartup() { // startup
        return await errorAwait(logTag, async () => await client.connect(), [], 'Startup -')
            .then(() => {
                const db = client.db(mongoName);
                collections = Object.fromEntries(Object.keys(collections).map(c => [c, db.collection(c)]));
            });
    }
}