module.exports = {
    emotes: {
        "A": "🇦",
        "B": "🇧",
        "C": "🇨",
        "D": "🇩",
        "E": "🇪",
        "F": "🇫",
        "G": "🇬",
        "H": "🇭",
        "I": "🇮",
        "J": "🇯",
        "K": "🇰",
        "L": "🇱",
        "M": "🇲",
        "N": "🇳",
        "O": "🇴",
        "P": "🇵",
        "Q": "🇶",
        "R": "🇷",
        "S": "🇸",
        "T": "🇹",
        "U": "🇺",
        "V": "🇻",
        "W": "🇼",
        "X": "🇽",
        "Y": "🇾",
        "Z": "🇿",
        'BB': '🅱️',
        'wave': '👋',
    },
    stringEmotes: async (msg, emoteList) => {
        for (const e of emoteList) {
            const emote = Object.keys(module.exports.emotes).includes(e) ? module.exports.emotes[e] : e;
            await msg.react(emote);
        }
    },
    itemInfo: (char, type, level) => `For more info on this item use ${'`'}/mnemonic name:${char} type:${type} level:${level}${'`'}.`,
    subInfo: (char, type, level) => `To see all the submissions for this item use ${'`'}/show submissions char:${char} type:${type} level:${level}${'`'}.`
}