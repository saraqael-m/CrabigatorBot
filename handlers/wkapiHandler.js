// console logging
const logTag = 'WKAPI';
const { logger, errorAwait } = require('../helpers/logger.js');

// requires
const { wanikani: { apiv2key } } = require('../../tokens.json');
const fetch = require('node-fetch');

const endpointStruct = token => ({
    method: 'GET',
    headers: {
        'Wanikani-Revision': '20170710',
        Authorization: 'Bearer ' + token
    }
});

const getEndpoint = async (url, token = apiv2key) => await fetch(url, endpointStruct(token)).then(e => e.json());

const getData = async (path, token) => {
    var data = [], url = 'https://api.wanikani.com/v2/' + path;
    while (1) {
        let result;
        try {
            result = await getEndpoint(url, token);
        } catch (e) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // wait 1 second
            continue;
        }
        if (result.pages) data.push(...result.data);
        else return result.data;
        url = result.pages.next_url;
        if (url == null) break;
    }
    return data;
}

// startup
const subjectDataJSONPath = '../itemdata/subjectData.json';
module.exports.subjectData = require(subjectDataJSONPath);
module.exports.subjectsUpdated = false;

module.exports.wkapiStartup = async () => {
    // get subject data
    const temp = await errorAwait(logTag, async () => await getData('subjects'), [], 'Retrieve - Subject Data', true);
    if (temp) { // if no error occured
        module.exports.subjectData = temp;
        module.exports.subjectsUpdated = true;
    } else logger(logTag, 'Fallback - Subject JSON', 'Used', subjectDataJSONPath);
}

module.exports.getUserInfo = async token => await getData('user', token);