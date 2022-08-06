const fs = require('fs');

const databaseName = 'mnemonicDB.json';

const itemData = {
    r: require('./itemdata/radicals.json'),
    k: require('./itemdata/kanji.json'),
    v: require('./itemdata/vocab.json'),
};


module.exports = {
    async submit(char, meaning, type, source, prompt, mnemonictype, imagelink, remarks, user) {
        let mnemonicDB = require('./' + databaseName);

        const getMeanings = meaning => meaning.split(', ').map(e => e.toLowerCase());

        const item = itemData[type].find(e => type != 'r' ? (e.char == char && getMeanings(e.meaning).includes(meaning.toLowerCase())) : (e.char == char || e.char == meaning || getMeanings(e.meaning).includes(meaning.toLowerCase())));
        if (item == undefined) {
            return [undefined, 'not_found', undefined];
        } else {
            let dbEntry = mnemonicDB.find(e => e.char == item.char && e.meaning == item.meaning && e.type == type);
            const newSubmission = {
                "date": new Date(),
                "user": user != null ? [user.id, user.username + "#" + user.discriminator] : null,
                "link": imagelink,
                "mnemonictype": mnemonictype,
                "source": source,
                "prompt": prompt,
                "remarks": remarks != null ? remarks : "",
                "accepted": false,
            };
            let submissionPlace = 1;
            if (dbEntry != undefined) {
                let currentSubmissions = dbEntry.submissions.slice();
                currentSubmissions.push(newSubmission);
                dbEntry.submissions = currentSubmissions;
                submissionPlace = currentSubmissions.length;
            } else {
                let newEntry = {
                    "char": item.char,
                    "meaning": item.meaning,
                    "type": type,
                    "submissions": [newSubmission],
                }
                mnemonicDB.push(newEntry);
            }
            try {
                fs.writeFile(databaseName, JSON.stringify(mnemonicDB), 'utf8', function (err) {
                    if (err) throw err;
                    console.log((user != null ? user.username : 'Unknown') + ' submitted an entry to "' + databaseName + '" DB at ' + new Date());
                });
            } catch (e) {
                console.error(e);
                return [undefined, 'database_error', undefined];
            }
            return [newSubmission, item, submissionPlace];
        }
    },
    async get(char, meaning, type, level, mnemonictype, user, accepted, source) {
        let mnemonicDB = require('./' + databaseName);

        const getMeanings = meaning => meaning.split(', ').map(e => e.toLowerCase());
        const findLevelItems = (arr, level) => arr.match(e => e.level == level);

        var foundSubmissions;
        if (level != null) {
            const possibleItems = type != null ? findLevelItems(itemData[type], level) : findLevelItems([...itemData.r, ...itemData.k, ...itemData.v], level);
            foundSubmissions = mnemonicDB
                .filter(item => (possibleItems.find(e => e.char = item.char && e.meaning == item.meaning) != undefined) && (char == null || char == item.char) && (meaning == null || getMeanings(meaning).includes(meaning.toLowerCase())) && (type == null || type == item.type));
        } else {
            foundSubmissions = mnemonicDB
                .filter(item => (char == null || char == item.char) && (meaning == null || getMeanings(meaning).includes(meaning.toLowerCase())) && (type == null || type == item.type));
        }
        
        return foundSubmissions
            .map(item => item.submissions).flat()
            .filter(sub => (mnemonictype == null || mnemonictype == sub.mnemonictype) && (user == null || (sub.user != null ? user.id == sub.user[0] : false)) && (accepted == null || accepted == sub.accepted) && (source == null || source.toLowerCase().match(/^[a-z0-9]+$/ig).join('') == sub.source.toLowerCase().match(/^[a-z0-9]+$/ig).join('')));
    },
    async progress() {
        let mnemonicDB = require('./' + databaseName);

        return [mnemonicDB.length, itemData.r.length + itemData.k.length + itemData.v.length, mnemonicDB.map(e => e.submissions.length).reduce((p, c) => p + c)];
    }
}