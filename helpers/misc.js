module.exports = {
    md5EncryptHex: (data) => require('crypto').createHash('md5').update(data).digest('hex')
}