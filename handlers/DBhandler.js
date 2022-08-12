// console logging
const namespace = 'DB';
const logger = (action, status, arg) => console.log(`(${namespace}) ${action} ${status}${arg != undefined && arg.length != 0 ? ': "' + arg + '"' : ''}`);

const fs = require('fs'),
    { uploadImageFromUrl, folderNames } = require('./bunnyHandler.js');

const databaseName = 'mnemonicDB.json';
const imageNaming = (wkid, itype, mtype, subid, name) => encodeURI(`${wkid}_${itype}${mtype}${subid}_${name}-${new Date().toISOString().match(/[a-zA-Z0-9]/g).join('')}`);

const itemData = {
    r: require('../itemdata/radicals.json'),
    k: require('../itemdata/kanji.json'),
    v: require('../itemdata/vocab.json'),
};

const backupDatabase = () => {
    let mnemonicDB = require('./' + databaseName);
    const date = new Date();
    const addZeroes = n => n < 10 ? '0' + n : String(n);
    try {
        fs.writeFile(`backups/${addZeroes(date.getFullYear())}-${addZeroes(date.getMonth() + 1)}-${addZeroes(date.getDate())}_${addZeroes(date.getHours())}-${addZeroes(date.getMinutes())}.json`, JSON.stringify(mnemonicDB), 'utf8', function (err) {
            if (err) throw err;
            logger('Backup -', 'Success', new Date());
        });
    } catch (e) {
        logger(`Backup -`, 'Failed', new Date());
        console.error(e);
        return;
    }
    try {
        fs.writeFile('backups/lastSave.json', JSON.stringify(date), 'utf8', function (err) {
            if (err) throw err;
            logger('Backup - Update "lastSave.json"', 'Success', new Date());
        });
    } catch (e) {
        logger(`Backup - Update "lastSave.json"`, 'Failed', new Date());
        console.error(e);
    }
    return date;
}

if (new Date() - new Date(require('./backups/lastSave.json')) > 8.64e+7) {
    backupDatabase();
}

module.exports = {
    async submit(char, meaning, type, source, prompt, mnemonictype, imagelink, remarks, user, otheruser) {
        let mnemonicDB = require('./' + databaseName);

        const getMeanings = meaning => meaning.split(', ').map(e => e.toLowerCase());
        const item = itemData[type].find(e => type != 'r' ? (e.char == char && getMeanings(e.meaning).includes(meaning.toLowerCase())) : (e.char == char || e.char == meaning || getMeanings(e.meaning).includes(meaning.toLowerCase())));
        if (item == undefined) {
            logger(`Submit - by "${(user != null ? user.username : 'Unknown')}"`, 'Failed (Not Found)', new Date());
            return [undefined, 'item_not_found', undefined];
        } else {
            let dbEntry = mnemonicDB.find(e => e.char == item.char && e.meaning == item.meaning && e.type == type);
            const submissionPlace = dbEntry != undefined ? dbEntry.submissions.length + 1 : 1;
            var bunnyLink = null;
            try {
                bunnyLink = await uploadImageFromUrl(imagelink, folderNames[type] + '/' + imageNaming(item.id, type, mnemonictype, submissionPlace, item.char != null ? item.char : item.meaning));
            } catch (e) {
                logger(`Submit - ${(user != null ? user.username : 'Unknown')}`, 'Failed (Image Upload)', new Date());
                return [undefined, 'image_upload_error', undefined];
            }
            const newSubmission = {
                "date": new Date(),
                "user": user != null ? [user.id, user.username + "#" + user.discriminator] : (otheruser != null ? [undefined, otheruser] : null),
                "link": bunnyLink,
                "mnemonictype": mnemonictype,
                "source": source,
                "prompt": prompt,
                "remarks": remarks != null ? remarks : "",
                "accepted": false,
            };
            if (dbEntry != undefined) {
                let currentSubmissions = dbEntry.submissions.slice();
                currentSubmissions.push(newSubmission);
                dbEntry.submissions = currentSubmissions;
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
                    logger(`Submit - ${(user != null ? user.username : 'Unknown')}`, 'Success', new Date());
                });
            } catch (e) {
                logger(`Submit - ${(user != null ? user.username : 'Unknown')}`, 'Failed (Database)', new Date());
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

        foundSubmissions = foundSubmissions
            .map(item => item.submissions).flat()
            .filter(sub => (mnemonictype == null || mnemonictype == sub.mnemonictype) && (user == null || (sub.user != null ? user.id == sub.user[0] : false)) && (accepted == null || accepted == sub.accepted) && (source == null || source.toLowerCase().match(/^[a-z0-9]+$/ig).join('') == sub.source.toLowerCase().match(/^[a-z0-9]+$/ig).join('')));
        logger('Get Submissions -', 'Success', foundSubmissions.length + ' submission(s)');
        return foundSubmissions;
    },
    async progress() {
        let mnemonicDB = require('./' + databaseName);

        logger('Get Progress -', 'Success');
        return [mnemonicDB.length, itemData.r.length + itemData.k.length + itemData.v.length, mnemonicDB.map(e => e.submissions.length).reduce((p, c) => p + c)];
    },
    async backup() {
        return backupDatabase();
    }
}