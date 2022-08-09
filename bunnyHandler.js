const namespace = 'Bunny';
const logger = (action, status, arg) => console.log(`(${namespace}) ${action} ${status}${arg != undefined && arg.length != 0 ? ': "' + arg + '"'  : ''}`);

const BunnyStorage = require('bunnycdn-storage').default,
    fs = require('fs'),
    request = require('request'),
    { bunnyCDNStorage: { bunnyToken, bunnyName, bunnyRegion } } = require('../tokens.json');

const bunnyStorage = new BunnyStorage(bunnyToken, bunnyName, bunnyRegion);
const bunnyUrl = path => `https://${bunnyName}.b-cdn.net/${path}`;

const errorAwait = async (func, args, name, returnResult = false) => {
    var result;
    try {
        result = await func(...args);
    } catch (e) {
        logger(name, 'Failed', args);
        console.error(e);
        return false;
    }
    logger(name, 'Success', args);
    return returnResult ? result : true;
}

const getItemDir = async path => {
    const files = await errorAwait(async a => bunnyStorage.list(a), [path], 'Get Dir -', true);
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
        const completeFileName = name + fileExt;
        await errorAwait(() => { download(url, 'temp/temp' + fileExt, async (type, length) => logger('Upload -', `Type: ${type}; Length: ${length}`)); }, [], 'Upload - 1/2 Temp Download')
            .then(() => errorAwait(async (a, b) => bunnyStorage.upload(a, b), ['temp/temp' + fileExt, completeFileName], 'Upload - 2/2 Cloud Upload'));
        return bunnyUrl(completeFileName);
    },
    async downloadImage(path) {
        // folder in path has to have preceeding slash (e.g. "vocab/")
        return await errorAwait(async a => bunnyStorage.download(a), [path], 'Download -');
    },
    async deleteImage(path) {
        // folder in path has to have preceeding slash (e.g. "vocab/")
        return await errorAwait(async a => bunnyStorage.delete(a), [path], 'Delete -');
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
                logger('Get Item - Id and Sub', 'Success');
                return bunnyUrl(folder + item);
            }
        }
        logger('Get Item - Id and Sub', 'Failed');
        return false;
    },
    folderNames: {
        r: 'Radicals',
        k: 'Kanji',
        v: 'Vocabulary',
    }
}