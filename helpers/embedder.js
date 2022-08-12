const { EmbedBuilder } = require('discord.js');

module.exports = {
    simpleEmbed(color, title, desc) {
        return new EmbedBuilder().setColor(color).setTitle(title).setDescription(desc);
    },
    successEmbed(title, body, info = undefined) {
        return module.exports.simpleEmbed(0x08c92c, title + (info != undefined && info != '' ? ' - ' + info : ''), body);
    },
    pendingEmbed(title, body, info = undefined) {
        return module.exports.simpleEmbed(0xe8c227, title + (info != undefined && info != '' ? ' - ' + info : ''), '**Pending:** ' + body);
    },
    errorEmbed(title, body, info = undefined) {
        return module.exports.simpleEmbed(0xe83427, title + (info != undefined && info != '' ? ' - ' + info : ''), '**Error:** ' + body);
    },
    submitEmbed(title, body, imagelink, info = undefined) {
        return module.exports.successEmbed(title, body, info)
            .setImage(imagelink)
            .setTimestamp();
    }
}