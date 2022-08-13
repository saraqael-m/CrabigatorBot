const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ActionRow } = require('discord.js');

module.exports = {
    linkRow(links) {
        const buttons = links.map(link => new ButtonBuilder()
            .setLabel(link[0])
            .setStyle(ButtonStyle.Link)
            .setURL(link[1]));
        return new ActionRowBuilder().addComponents(...buttons);
    },
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
    },
    pagesEmbed(color, title, desc, fields, imagelink = undefined, rightEdge = false, leftEdge = false) {
        const button = (id, lbl, style) => new ButtonBuilder()
            .setCustomId(id)
            .setStyle(style)
            .setEmoji(lbl);
        var embed = module.exports.simpleEmbed(color, title, desc);
        if (fields.length != 0) embed = embed.addFields(...fields);
        if (imagelink) embed = embed.setImage(imagelink);
        return {
            embeds: [embed],
            components: [
                new ActionRowBuilder() //⏮️◀️🔀▶⏭️
                    .addComponents(
                        (leftEdge ? button('fullLeft', '⏮️', ButtonStyle.Secondary).setDisabled(true) : button('fullLeft', '⏮️', ButtonStyle.Secondary)),
                        (leftEdge ? button('left', '◀️', ButtonStyle.Primary).setDisabled(true) : button('left', '◀️', ButtonStyle.Primary)),
                        button('random', '🔀', ButtonStyle.Secondary),
                        (rightEdge ? button('right', '▶', ButtonStyle.Primary).setDisabled(true) : button('right', '▶', ButtonStyle.Primary)),
                        (rightEdge ? button('fullRight', '⏭️', ButtonStyle.Secondary).setDisabled(true) : button('fullRight', '⏭️', ButtonStyle.Secondary)),
                    )
            ]
        }
    }
}