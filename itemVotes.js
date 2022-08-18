// console logging
const logTag = 'Voter';
const { logger, errorAwait } = require('./helpers/logger.js');

const { discord: { clientId, channelIds: { voteChannelIds: { radVoteId, kanVoteId, vocVoteId, voteInfoId } } } } = require('../tokens.json');
const { finder, update } = require('./handlers/mongoHandler.js');
const { emotes, stringEmotes, subInfo } = require('./helpers/messager.js'),
    { embedBuilder, simpleEmbed } = require('./helpers/embedder.js'),
    { itemNames, mnemonicNames } = require('./helpers/namer.js'),
    { embedColors } = require('./helpers/styler.js');
const sendMnemonic = require('./commands/mnemonic.js').execute;
const { subjectData } = require('./handlers/wkapiHandler.js');

var client, voteChannels, prevCollectors = {}, insertVoting = {};

const electionTime = 10000//600000;
const winnerTime = 30000;

module.exports = {
    active: false,
    voterSetClient: async (newClient) => {
        client = newClient;
        module.exports.active = true;
        voteChannels = {
            r: await client.channels.fetch(radVoteId),
            k: await client.channels.fetch(kanVoteId),
            v: await client.channels.fetch(vocVoteId),
            info: await client.channels.fetch(voteInfoId),
        };
        for (const [type, channel] of Object.entries(voteChannels)) {
            const messages = await channel.messages.fetch({ limit: 99 }).then(e => e.filter(m => m.author.id == clientId));
            logger(logTag, `Cleanup ${type} - ${Array.from(messages).length} Message(s) Deleted`);
            await channel.bulkDelete(messages);
        }
    },
    insertElection: async (type, pair) => {
        insertVoting[type] = pair;
        console.log(pair);
    },
    createElection: async (type) => {
        logger(logTag, `Create - Election ${type}`, 'Pending', type);
        if (!module.exports.active) return false;
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
        const insertion = insertVoting[type];
        var possiblePairs;
        if (insertion) { // manually inserted election
            const insertSubs = db.find(e => e.wkId == insertion[1]).submissions;
            possiblePairs = [[insertion[0].map(e => insertSubs.find(s => s.subId == e)), insertion[1], insertion[2]]];
            insertVoting[type] = undefined;
        } else { // otherwise find all possible pairs
            possiblePairs = db.filter(e => e.type == type).map(e => {
                if (type == 'r') return e.submissions.length > 1 ? [[pickPair(e.submissions), e.wkId, 'm']] : []; // radicals only have meaning
                if (e.submissions.find(s => s.mnemonictype == 'b' && s.accepted == true)) return []; // both accepted -> no voting anymore
                const b = e.submissions.filter(s => s.mnemonictype == 'b'),
                    r = e.submissions.find(s => s.mnemonictype == 'r' && s.accepted == true) ? [] : e.submissions.filter(s => s.mnemonictype == 'r'),
                    m = e.submissions.find(s => s.mnemonictype == 'm' && s.accepted == true) ? [] : e.submissions.filter(s => s.mnemonictype == 'm');
                return [ // all possible pair ups for meaning and reading
                    (r.length > 1 ? [pickPair(r), e.wkId, 'r'] : (r.length + b.length > 1 && b.length < 2 ? [pickPair([...r, ...b]), e.wkId, 'r'] : false)),
                    (m.length > 1 ? [pickPair(m), e.wkId, 'm'] : (m.length + b.length > 1 && b.length < 2 ? [pickPair([...m, ...b]), e.wkId, 'm'] : false)),
                    (b.length > 1 ? [pickPair(b), e.wkId, 'b'] : false),
                ].filter(p => p);
            }).flat();
        }
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
        const item = subjectData.find(e => e.id == itemId);
        var messages = [];
        await sendMnemonic({ // emulate interaction
            user: { username: '#Bot' },
            options: {
                getString(name) {
                    switch (name) {
                        case 'name': return item.data.characters;
                        case 'type': return type;
                    }
                },
                getInteger(name) {
                    switch (name) {
                        case 'level': return item.data.level;
                    }
                },
            },
            reply: () => undefined,
            editReply: async content => messages.push(await channel.send(content)),
        });
        const voteEmotes = [emotes.A, emotes.B];
        const votingMsg = await channel.send({ // main message
            embeds: [
                embedBuilder()
                    .setTitle(`${itemNames[type]} Voting (${mnemonicNames[mnemonictype]}) - ${item.data.characters} (${item.data.meanings[0].meaning})`)
                    .setDescription(`*Vote for the submission that you think is more recognizable, appealing, and fits the **${mnemonicNames[mnemonictype]}** mnemonic better.*\n\n`
                        + '*HOW TO:* Click the emotes at the bottom of the message to vote.\n\n'
                        + `It takes ${(electionTime/60000).toFixed(0)} minutes for the voting to change its item.\n\n`
                        + 'To read the mnemonic see the message above.\n'
                        + subInfo(item.data.characters, itemNames[type], item.data.level)
                    ),
                ...randomPair.map((e, i) => embedBuilder().setTitle(voteEmotes[i]).setDescription(`Previous votes: ${e.votes}`).setImage(e.thumblink).setFooter({ text: `ID ${itemId}/${e.subId}` }))
            ]
        });
        var votedUsers = db.find(e => e.wkId == itemId).uservotes || {};
        const collector = votingMsg.createReactionCollector({ filter: (i, user) => user.id != clientId && voteEmotes.includes(i.emoji.name), time: electionTime + 2000 });
        collector.on('collect', (e, user) => { // check if user has already voted
            const currentVotes = votedUsers[user.id],
                currentMnemonictype = randomPair[voteEmotes.findIndex(v => v == e.emoji.name)].mnemonictype,
                currentSubId = randomPair[voteEmotes.findIndex(v => v == e.emoji.name)].subId;
            if (currentVotes) {
                const previousSubId = currentVotes[currentMnemonictype];
                if (previousSubId) {
                    if (previousSubId == currentSubId) voteChannels.info.send({ content: `<@${user.id}>: You have already voted for this submission!` })
                    else voteChannels.info.send({ content: `<@${user.id}>: You changed your vote for this item from submission ${previousSubId} to ${currentSubId}.` });
                }
            } else votedUsers[user.id] = { m: undefined, r: undefined, b: undefined };
            votedUsers[user.id][currentMnemonictype] = currentSubId;
        });
        messages.push(votingMsg);
        await stringEmotes(votingMsg, voteEmotes); // add emotes
        prevCollectors[type] = {
            async stop() { // delete messages, update database, and send winner msg
                //const emoteAmounts = Array.from(votingMsg.reactions.cache).map(e => [e[0], e[1].count]); // get reaction amounts from voting message
                //const collectedVotes = voteEmotes.map(v => emoteAmounts.find(e => e[0] == v)[1] - 1); // turn them into collected votes array
                try { collector.stop(); } catch (e) { console.log(e); } // stop the collector
                const totalVotes = randomPair.map(s => Object.values(votedUsers).length == 1 ? (Object.values(Object.values(votedUsers)[0]).includes(s.subId) ? 1 : 0) : Object.values(votedUsers).map(u => Object.values(u).includes(s.subId) ? 1 : 0).reduce((p, c) => p + c, 0));
                const dbItem = await finder({ wkId: itemId }).then(i => i[0]);
                await update({ wkId: itemId },
                    {
                        $set: {
                            uservotes: votedUsers,
                            ...Object.fromEntries(randomPair.map((s, i) => {
                                const foundIndex = dbItem.submissions.findIndex(e => e.subId == s.subId);
                                return foundIndex != -1 ? [`submissions.${foundIndex}.votes`, totalVotes[i]] : false;
                            }).filter(e => e))
                        }
                    },
                    { upsert: false });
                for (const m of messages) { // delete messages
                    await errorAwait(logTag, async () => await m.delete(), [], `Collector ${type} - Delete Message`);
                }
                if (module.exports.active) { // winner message
                    const collectedVotes = totalVotes.map((e, i) => e - randomPair[i].votes);
                    const highestVotes = Math.max(...totalVotes);
                    var winnerIndex = totalVotes.findIndex(v => v == highestVotes);
                    winnerIndex = winnerIndex == totalVotes.lastIndexOf(highestVotes) ? winnerIndex : null;
                    var embed = simpleEmbed(winnerIndex !== null ? embedColors.winner : embedColors.neutral, `${itemNames[type]} Voting (${mnemonicNames[mnemonictype]}) - ${dbItem.char} (${dbItem.meaning}) - ` + (winnerIndex !== null ? `Winner ${voteEmotes[winnerIndex]}` : 'Draw'),
                        (winnerIndex !== null ? `The winner of this voting was decided:\n**Submission ${voteEmotes[winnerIndex]} won!**` : 'There was a tie between the submissions.') + '\n\n'
                            + `*The next voting will start shortly (max. ${(winnerTime / 1000).toFixed(0)} seconds).*`)
                        .addFields(...randomPair.map((_, i) => [ // display vote info
                            { name: '\u200B', value: voteEmotes[i], inline: false },
                            { name: 'New Votes', value: collectedVotes[i].toString(), inline: true },
                            { name: 'Previous Votes', value: randomPair[i].votes.toString(), inline: true },
                            { name: 'Total Votes', value: totalVotes[i].toString(), inline: true },
                        ]).flat())
                        .setFooter({ text: '*New Votes* are the votes that a submission acquired in this voting. *Previous Votes* are the ones from previous votings. And, *Total Votes* are the total number of votes for that submission.' });
                    if (winnerIndex !== null) embed = embed.setImage(randomPair[winnerIndex].thumblink);
                    const winnerMsg = await channel.send({
                        embeds: [embed]
                    });
                    new Promise(res => setTimeout(res, winnerTime)).then(async () => {
                        await errorAwait(logTag, async () => await winnerMsg.delete(), [], `Collector ${type} - Delete Winner Message`);
                        if (module.exports.active) module.exports.createElection(type); // start new election if active
                    });
                }
            }
        };
        new Promise(res => setTimeout(res, electionTime)).then(async () => await module.exports.deleteMessages(type));
    },
    async deleteMessages(type) {
        if (prevCollectors[type] != undefined) {
            const current = prevCollectors[type];
            prevCollectors[type] = undefined;
            try {
                await current.stop(); // delete election messages
            } catch (e) { // if it doesn't work it's a message
                console.log(e);
                await errorAwait(logTag, async () => await current.delete(), [], `Collector ${type} - Delete Message`);
            }
        }
    },
    async electionShutdown() {
        module.exports.active = false;
        for (const type of ['r', 'k', 'v']) await module.exports.deleteMessages(type);
    }
}