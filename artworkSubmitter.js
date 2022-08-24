module.exports = {
	async submitAmandaBear() {
		const subjectData = require('./handlers/wkapiHandler.js').subjectData;
		const arr = require('./itemdata/amandaBear.json');
		const submit = require('./commands/submit.js').execute;
		for (const [id, data] of Object.entries(arr)) {
			const item = subjectData.find(e => e.id == parseInt(id));
            const interaction = {
				options: {
					getString(name) {
						switch (name) {
							case 'char': return item.data.char || item.data.slug
							case 'type': return data[2][0].toLowerCase()
							case 'source': return 'drawing'
							case 'prompt': return 'none'
							case 'mnemonictype': return 'm'
							case 'remarks': return 'source: https://community.wanikani.com/t/wk-mnemonic-art-for-kanji-levels-1-7-radical-levels-1-10/47656'
							case 'otheruser': return 'AmandaBear'
							default: return null
                        }
					},
					getAttachment(name) {
						switch (name) {
							case 'image': return { url: data[0] }
							default: return null
						}
					},
					getUser(name) {
						switch (name) {
							default: return null
						}
					},
					getInteger(name) {
						switch (name) {
							default: return null
						}
					},
				},
				reply() { console.log('Used "reply".'); },
				editReply() { console.log('Used "editReply".'); },
			}
			await submit(interaction);
        }
	}
}

module.exports.submitAmandaBear();