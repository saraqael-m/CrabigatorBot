// console logging
const logTag = 'Voter';
const { logger, errorAwait } = require('./helpers/logger.js');

const { discord: { clientId, channelIds: { voteChannelIds: { radVoteId, kanVoteId, vocVoteId } } } } = require('../tokens.json');
const { finder, update } = require('./handlers/mongoHandler.js');
const { emotes, stringEmotes, subInfo } = require('./helpers/messager.js'),
    { embedBuilder, simpleEmbed } = require('./helpers/embedder.js'),
    { itemNames, mnemonicNames } = require('./helpers/namer.js'),
    { embedColors } = require('./helpers/styler.js');
const sendMnemonic = require('./commands/mnemonic.js').execute;

var client, voteChannels, prevCollectors = {};

const electionTime = 600000;

module.exports = {
    active: false,
    voterSetClient: async (newClient) => {
        client = newClient;
        module.exports.active = true;
        voteChannels = {
            r: await client.channels.fetch(radVoteId),
            k: await client.channels.fetch(kanVoteId),
            v: await client.channels.fetch(vocVoteId),
        };
        for (const [type, channel] of Object.entries(voteChannels)) {
            const messages = await channel.messages.fetch({ limit: 99 }).then(e => e.filter(m => m.author.id == clientId));
            logger(logTag, `Cleanup ${type} - ${Array.from(messages).length} Message(s) Deleted`);
            await channel.bulkDelete(messages);
        }
    },
    createElection: async (type, pairs = undefined) => {
        logger(logTag, `Create - Election ${type}`, 'Pending', type);
        const channel = voteChannels[type];
        const db = await finder({ type: type });
        const randomInt = (n) => Math.floor(Math.random() * n)
        const pickPair = (arr) => { // pick two random elements from an array that are not the same
            if (arr.length < 2) return;
            const firstIndex = randomInt(arr.length);
            var secondIndex = randomInt(arr.length);
            while (secondIndex == firstIndex) secondIndex = randomInt(arr.length);
            return [arr[firstIndex], arr[secondIndex]];
        }
        const possiblePairs = pairs ? pairs : db.filter(e => e.type == type).map(e => {
            if (type == 'r') return e.submissions.length > 1 ? [[pickPair(e.submissions), e.wkId, 'm']] : []; // radicals only have meaning
            const b = e.submissions.filter(s => s.mnemonictype == 'b'),
                r = e.submissions.filter(s => s.mnemonictype == 'r'),
                m = e.submissions.filter(s => s.mnemonictype == 'm');
            return [ // all possible pair ups for meaning and reading
                    (r.length > 1 ? [pickPair(r), e.wkId, 'r'] : (r.length + b.length > 1 && b.length < 2 ? [pickPair([...r, ...b]), e.wkId, 'r'] : false)),
                    (m.length > 1 ? [pickPair(m), e.wkId, 'm'] : (m.length + b.length > 1 && b.length < 2 ? [pickPair([...m, ...b]), e.wkId, 'm'] : false)),
                    (b.length > 1 ? [pickPair(b), e.wkId, 'b'] : false),
                ].filter(p => p);
        }).flat();
        await module.exports.deleteMessages(type); // delete old election
        if (possiblePairs.length == 0) {
            logger(logTag, `Create - Election ${type} (No Items)`, 'Sent', type);
            const msg = await channel.send({
                embeds: [simpleEmbed(embedColors.neutral, `${itemNames[type]} Voting - None Found`,
                    `There are currently no ${itemNames[type].toLowerCase()} items with multiple submissions so there is nothing to vote on.`)]
            });
            prevCollectors[type] = msg;
            if (module.exports.active) new Promise(res => setTimeout(res, electionTime)).then(() => { if (prevCollectors[type].id == msg.id) module.exports.createElection(type); });
            return false;
        }
        const [randomPair, itemId, mnemonictype] = possiblePairs[randomInt(possiblePairs.length)];
        const item = db.find(e => e.wkId = itemId);
        var messages = [];
        await sendMnemonic({ // emulate interaction
            user: { username: '#Bot' },
            options: {
                getString(name) {
                    switch (name) {
                        case 'name': return item.char;
                        case 'type': return type;
                    }
                },
                getInteger(name) {
                    switch (name) {
                        case 'level': return item.level;
                    }
                },
            },
            reply: () => undefined,
            editReply: async content => messages.push(await channel.send(content))
        });
        const voteEmotes = [emotes.A, emotes.B];
        var collectedVotes = randomPair.map(_ => 0), usersVoted = [];
        const msg = await channel.send({ // main message
            embeds: [
                embedBuilder()
                    .setTitle(`${itemNames[type]} Voting (${mnemonicNames[mnemonictype]}) - ${item.char} (${item.meaning})`)
                    .setDescription(`*Vote for the submission that you think is more recognizable, appealing, and fits the **${mnemonicNames[mnemonictype]}** mnemonic better.*\n\n`
                        + '*HOW TO:* Click the emotes at the bottom of the message to vote. And remember, **only the first vote counts**: each subsequent reaction to this message will not be registered.\n\n'
                        + `It takes ${(electionTime/60000).toFixed(0)} minutes for the voting to change its item.\n\n`
                        + 'To read the mnemonic see the message above.\n'
                        + subInfo(item.char, itemNames[type], item.level)
                    ),
                ...randomPair.map((e, i) => embedBuilder().setTitle(voteEmotes[i]).setImage(e.thumblink))
            ]
        });
        messages.push(msg);
        await stringEmotes(msg, voteEmotes); // add emotes
        const collector = msg.createReactionCollector({ filter: (i, u) => voteEmotes.includes(i.emoji.name) && u.id != clientId, time: electionTime });
        collector.on('collect', (reaction, user) => { // save votes
            if (usersVoted.includes(user.id)) return;
            collectedVotes[voteEmotes.findIndex(e => e == reaction.emoji.name)]++; // add to vote array
            usersVoted.push(user.id); // add user to user array so that they can't vote again
            logger(logTag, `Collector ${type} - "${reaction.emoji.name}" from "${user.tag}"`);
        });
        collector.on('end', async collected => { // delete messages and update database
            await update({ wkId: itemId }, { $inc: Object.fromEntries(randomPair.map((s, i) => [`submissions.${item.submissions.findIndex(e => e.subId == s.subId)}.votes`, collectedVotes[i]])) })
            logger(logTag, `Collector ${type} - ${collected.size} Vote(s),`, 'Terminated');
            for (const m of messages) {
                await errorAwait(logTag, async () => await m.delete(), [], `Collector ${type} - Delete Message`);
            }
            if (module.exports.active) module.exports.createElection(type);
        });
        prevCollectors[type] = collector;
    },
    async deleteMessages(type) {
        if (prevCollectors[type] != undefined) try {
            await prevCollectors[type].stop(); // delete election message by stopping the collector
        } catch (e) { // if it doesn't work it's a message
            await errorAwait(logTag, async () => await prevCollectors[type].delete(), [], `Collector ${type} - Delete Message`);
        }
    },
    async electionShutdown() {
        module.exports.active = false;
        for (const type of ['r', 'k', 'v']) await module.exports.deleteMessages(type);
    }
}