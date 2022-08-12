// console logging
const namespace = 'WKAPI';
const { errorAwait } = require('../helpers/logger.js');

// requires
const { wanikani: { apiv2key } } = require('../../tokens.json');
const fetch = require('node-fetch');

const getEndpoint = async url => await fetch(url, {
    method: 'GET',
    headers: {
        'Wanikani-Revision': '20170710',
        Authorization: 'Bearer ' + apiv2key
    }
}).then(e => e.json());

// startup
module.exports.subjectData = require('../itemdata/subjectData.json');
module.exports.subjectsUpdated = false;
const getData = async (path) => {
    var data = [], url = 'https://api.wanikani.com/v2/' + path;
    while (1) {
        let result;
        try {
            result = await getEndpoint(url);
        } catch (e) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // wait 1 second
            continue;
        }
        data.push(...result.data);
        url = result.pages.next_url;
        if (url == null) break;
    }
    return data;
}
const loadSubjectData = async () => {
    const temp = await errorAwait(namespace, async () => await getData('subjects'), [], 'Retrieve - Subject Data', true);
    if (temp) { // if no error occured
        module.exports.subjectData = temp;
        module.exports.subjectsUpdated = true;
    }
}
loadSubjectData();