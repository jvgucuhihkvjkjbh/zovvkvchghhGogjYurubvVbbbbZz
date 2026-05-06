const fs = require('fs');
const path = require('path');
const config = require('../config');
const { cmd } = require('../command');
const { StickerTypes, createSticker } = require('wa-sticker-formatter');

const AUTOSTICKER_PATH = path.join(__dirname, '../assets/autosticker.json');

const getAutoStickerData = () => {
    try {
        delete require.cache[require.resolve('../assets/autosticker.json')];
        return JSON.parse(fs.readFileSync(AUTOSTICKER_PATH, 'utf8'));
    } catch {
        return {};
    }
};

cmd({
    on: "body"
},
async (conn, mek, m, { from, body }) => {
    try {
        if (config.AUTO_STICKER !== 'true') return;
        if (!body) return;

        if (!fs.existsSync(AUTOSTICKER_PATH)) return;

        const data = getAutoStickerData();

        const matchText = Object.keys(data).find(t => t.toLowerCase() === body.toLowerCase());
        if (!matchText) return;

        const stickerPath = path.join(__dirname, '../assets/autosticker', data[matchText]);
        if (!fs.existsSync(stickerPath)) return;

        const stickerBuffer = fs.readFileSync(stickerPath);

        const sticker = await createSticker(stickerBuffer, {
            pack: '.  ̶͟ ̶̽ ̶͟ ̶͟ ͟𝐀𝐃𝐄𝐄𝐋⸼˺┇🌸• ⑅⃝⃕͜➳ᷝ͢•ⷨ𝟎𝟑𝟎𝟑𝟓𝟓𝟏𝟐𝟗𝟔𝟕',
            author: 'AUTO-STICKER',
            type: StickerTypes.FULL,
            quality: 100
        });

        await conn.sendMessage(from, {
            sticker
        }, { quoted: mek });

    } catch (err) {
        console.error("AutoSticker Error:", err);
    }
});