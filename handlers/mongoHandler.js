// console logging
const namespace = 'Mongo';
const { errorAwait } = require('../helpers/logger.js');

// database connection
const { mongoDB: { mongoUsername, mongoPassword } } = require('../../tokens.json');
const { MongoClient, ServerApiVersion } = require('mongodb');
const connectionString = `mongodb+srv://${mongoUsername}:${mongoPassword}@cluster0.acrkbmu.mongodb.net/wk-mnemonic-images`;
const client = new MongoClient(connectionString, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

var collection;

// main database functions
module.exports = {
    async append(item) { return await errorAwait(namespace, async a => await collection.insertOne(a), [item], 'Append - Single', true); },
    async remove(cond) { return await errorAwait(namespace, async a => await collection.deleteOne(a), [cond], 'Remove - Single', true); },
    async update(cond, item) { return await errorAwait(namespace, async (a, b) => await collection.updateOne(a, b), [cond, item], 'Update - Single', true); },
    async appmul(item) { return await errorAwait(namespace, async a => await collection.insertMany(a), [item], 'Append - Multiple', true); },
    async remmul(cond) { return await errorAwait(namespace, async a => await collection.deleteMany(a), [cond], 'Remove - Multiple', true); },
    async updmul(cond, item) { return await errorAwait(namespace, async (a, b) => await collection.updateMany(a, b), [cond, item], 'Update - Multiple', true); },
    async finder(cond) { return await errorAwait(namespace, async a => await collection.find(a).toArray(), [cond], 'Find -', true); },
    async mongoShutdown() { // shutdown (not necessary)
        return await errorAwait(namespace, async () => await client.close(), [], 'Shutdown -');
    },
    async mongoStartup() { // startup
        return await errorAwait(namespace, async () => await client.connect(), [], 'Startup -')
            .then(() => collection = client.db('wk-mnemonic-images').collection('main'));
    }
}