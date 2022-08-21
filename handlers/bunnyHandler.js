// console logging
const logTag = 'Bunny';
const { logger, errorAwait } = require('../helpers/logger.js');

const BunnyStorage = require('bunnycdn-storage').default,
    { bunnyCDNStorage: { bunnyToken, bunnyName, bunnyRegion } } = require('../../tokens.json');
const jimp = require('jimp'),
    axios = require('axios');

const bunnyStorage = new BunnyStorage(bunnyToken, bunnyName, bunnyRegion);
const bunnyUrl = path => `https://${bunnyName}.b-cdn.net/${path}`;

// base 64 for file names
const digit = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";
const toB64 = x => x.toString(2).split(/(?=(?:.{6})+(?!.))/g).map(v => digit[parseInt(v, 2)]).join("");

const getItemDir = async path => {
    const files = await errorAwait(logTag, async a => await bunnyStorage.list(a), [path], 'Get Dir -', true);
    return files.data.map(e => e.ObjectName);
}

module.exports = {
    async uploadImage(buffer, name, thumbSize = false) {
        const totalSteps = thumbSize ? 4 : 2;
        var step = 1;
        return await (async () => {
                if (!buffer) return [];
                var promiseArray = [
                    new Promise(async (resolve, reject) => await errorAwait(logTag, async () => await jimp.read(buffer, async (err, image) => {
                        if (err) { console.error(err); reject(false); };
                        await image
                            .getBufferAsync(jimp.MIME_PNG).then(result => { logger(logTag, 'Convert - Image', 'Success', (result.length / 1024).toFixed(2) + ' kB'); resolve(result) }); // get buffer
                    }), [], `Upload - ${step}/${totalSteps} Convert Image`, true)),
                    ...(thumbSize ? [new Promise(async (resolve, reject) => await errorAwait(logTag, async () => await jimp.read(buffer, async (err, image) => {
                        if (err) { console.error(err); reject(false); };
                        await image
                            .scaleToFit(thumbSize, thumbSize) // resize
                            .quality(65) // set JPEG quality
                            .getBufferAsync(jimp.MIME_JPEG).then(result => { logger(logTag, 'Convert - Thumb', 'Success', (result.length / 1024).toFixed(2) + ' kB'); resolve(result) }); // get buffer
                    }), [], `Upload - ${step}/${totalSteps} Convert Image`, true))] : []),
                ]
                return await Promise.all(promiseArray);
            })()
            .then(async images => {
                if (!images[0]) return [];
                step += thumbSize ? 2 : 1;
                const imageName = name + '.png',
                    thumbName = name + '-thumb.jpg';
                await Promise.all([
                    errorAwait(logTag, async () => await bunnyStorage.upload(images[0], imageName), [], `Upload - ${step}/${totalSteps} Upload Image`),
                    ...(thumbSize ? [errorAwait(logTag, async () => await bunnyStorage.upload(images[1], thumbName), [], `Upload - ${step + 1}/${totalSteps} Upload Thumb`)] : []),
                ]);
                return [bunnyUrl(imageName), ...(thumbSize ? [bunnyUrl(thumbName)] : [])];
            });
    },
    async simpleUploadImage(buffer, path) {
        return await errorAwait(logTag, async () => await bunnyStorage.upload(buffer, path), [], `Upload -`);
    },
    async downloadImage(path) {
        // folder in path has to have preceeding slash (e.g. "vocab/")
        return await errorAwait(logTag, async a => bunnyStorage.download(a), [path], 'Download -');
    },
    async deleteImage(path) {
        // folder in path has to have preceeding slash (e.g. "vocab/")
        return await errorAwait(logTag, async a => bunnyStorage.delete(a), [path], 'Delete -');
    },
    async getItemDir(path) {
        // folder in path has to have preceeding slash (e.g. "vocab/")
        return await getItemDir(path);
    },
    async getImageByName(name) {
        return bunnyUrl(name);
    },
    async purgeUrl(path) {
        const url = bunnyUrl(path); // full url
        return await errorAwait(logTag, async url => {
            axios.request({
                method: 'GET',
                url: url,
                headers: { Accept: 'application/json', AccessKey: bunnyToken }
            }).then((response) => response.status)
                .catch((error) => console.error(error));
        }, [url], 'Purger -', true);
    },
    async getImageByIdSub(id, subnum) {
        // wanikani id and submission number
        for (const folder of Object.values(module.exports.folderNames).map(e => e + '/')) {
            const item = getItemDir(folder).find(e => parseInt(e.split('_')[0]) == id && parseInt(e.split('_')[1].slice(2)) == subnum);
            if (item != undefined) {
                logger(logTag, 'Get Item - Id and Sub', 'Success');
                return bunnyUrl(folder + item);
            }
        }
        logger(logTag, 'Get Item - Id and Sub', 'Failed');
        return false;
    },
    folderNames: {
        r: 'Radicals',
        k: 'Kanji',
        v: 'Vocabulary',
    }
}