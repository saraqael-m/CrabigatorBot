// console logging
const namespace = 'Bunny';
const { logger, errorAwait } = require('../helpers/logger.js');

const BunnyStorage = require('bunnycdn-storage').default,
    fs = require('fs'),
    request = require('request'),
    { bunnyCDNStorage: { bunnyToken, bunnyName, bunnyRegion } } = require('../../tokens.json');

const bunnyStorage = new BunnyStorage(bunnyToken, bunnyName, bunnyRegion);
const bunnyUrl = path => `https://${bunnyName}.b-cdn.net/${path}`;

// base 64 for file names
const digit = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";
const toB64 = x => x.toString(2).split(/(?=(?:.{6})+(?!.))/g).map(v => digit[parseInt(v, 2)]).join("");

const getItemDir = async path => {
    const files = await errorAwait(namespace, namespace, async a => bunnyStorage.list(a), [path], 'Get Dir -', true);
    return files.data.map(e => e.ObjectName);
}

module.exports = {
    async uploadImageFromUrl(url, name) {
        const fileExt = '.' + url.split('.').slice(-1)[0].split('?')[0];
        const download = (fileurl, filename, callback) => {
            request.head(fileurl, (err, res, body) => {
                request(fileurl).pipe(fs.createWriteStream(filename)).on('close', () => callback(res.headers['content-type'], res.headers['content-length']));
            });
        };
        const completeFileName = name + fileExt,
            completeTempName = 'temp/bunny' + toB64(Math.floor(Math.random() * (64 ** 8))).padStart(8, '0') + fileExt;
        await new Promise((resolve, reject) => errorAwait(namespace, () => download(url, completeTempName, async (type, length) => { logger(namespace, 'Upload -', `Type: ${type}; Length: ${length}`); resolve(true); }), [], 'Upload - 1/3 Temp Download'))
            .then(() => errorAwait(namespace, async (a, b) => await bunnyStorage.upload(a, b), [completeTempName, completeFileName], 'Upload - 2/3 Cloud Upload'))
            .then(() => errorAwait(namespace, async a => await fs.unlink(a, err => { if (err) console.error(err); }), [completeTempName], 'Upload - 3/3 Temp Deletion'));
        return bunnyUrl(completeFileName);
    },
    async downloadImage(path) {
        // folder in path has to have preceeding slash (e.g. "vocab/")
        return await errorAwait(namespace, async a => bunnyStorage.download(a), [path], 'Download -');
    },
    async deleteImage(path) {
        // folder in path has to have preceeding slash (e.g. "vocab/")
        return await errorAwait(namespace, async a => bunnyStorage.delete(a), [path], 'Delete -');
    },
    async getItemDir(path) {
        // folder in path has to have preceeding slash (e.g. "vocab/")
        return await getItemDir(path);
    },
    async getImageByName(name) {
        return bunnyUrl(name);
    },
    async getImageByIdSub(id, subnum) {
        // wanikani id and submission number
        for (const folder of ['vocabulary/', 'kanji/', 'radicals/']) {
            const item = getItemDir(folder).find(e => parseInt(e.split('_')[0]) == id && parseInt(e.split('_')[1].slice(2)) == subnum);
            if (item != undefined) {
                logger(namespace, 'Get Item - Id and Sub', 'Success');
                return bunnyUrl(folder + item);
            }
        }
        logger(namespace, 'Get Item - Id and Sub', 'Failed');
        return false;
    },
    folderNames: {
        r: 'Radicals',
        k: 'Kanji',
        v: 'Vocabulary',
    }
}