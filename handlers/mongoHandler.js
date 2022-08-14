// console logging
const namespace = 'Mongo';
const { errorAwait } = require('../helpers/logger.js');

// database connection
const { mongoDB: { mongoUsername, mongoPassword, mongoName } } = require('../../tokens.json');
const { MongoClient, ServerApiVersion } = require('mongodb');
const connectionString = `mongodb+srv://${mongoUsername}:${mongoPassword}@cluster0.acrkbmu.mongodb.net/wk-mnemonic-images`;
const client = new MongoClient(connectionString, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

var subCollection;

const subCollectionName = 'submissions';

// main database functions
module.exports = {
    async append(item) { return await errorAwait(namespace, async a => await subCollection.insertOne(a), [item], 'Append - Single', true); },
    async remove(cond) { return await errorAwait(namespace, async a => await subCollection.deleteOne(a), [cond], 'Remove - Single', true); },
    async update(cond, item) { return await errorAwait(namespace, async (a, b) => await subCollection.updateOne(a, b), [cond, item], 'Update - Single', true); },
    async appmul(item) { return await errorAwait(namespace, async a => await subCollection.insertMany(a), [item], 'Append - Multiple', true); },
    async remmul(cond) { return await errorAwait(namespace, async a => await subCollection.deleteMany(a), [cond], 'Remove - Multiple', true); },
    async updmul(cond, item) { return await errorAwait(namespace, async (a, b) => await subCollection.updateMany(a, b), [cond, item], 'Update - Multiple', true); },
    async finder(cond) { return await errorAwait(namespace, async a => await subCollection.find(a).toArray(), [cond], 'Find -', true); },
    async mongoShutdown() { // shutdown (not necessary)
        return await errorAwait(namespace, async () => await client.close(), [], 'Shutdown -');
    },
    async mongoStartup() { // startup
        return await errorAwait(namespace, async () => await client.connect(), [], 'Startup -')
            .then(() => subCollection = client.db(mongoName).collection(subCollectionName));
    }
}