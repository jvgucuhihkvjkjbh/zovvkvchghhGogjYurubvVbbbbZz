const { cmd } = require('../command');
const config = require('../config');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

async function downloadViewOnce(msgContent, mediaType) {
    const stream = await downloadContentFromMessage(msgContent, mediaType);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }
    return buffer;
}

cmd({
    on: "viewonce"
},
async (conn, mek, m, { from }) => {
    try {
        const isEnabled = config.ANTI_VV === "true" || global.antiVVStatus === "true";
        if (!isEnabled) return;

        const wrapper = mek.message.viewOnceMessageV2 || mek.message.viewOnceMessage;
        if (!wrapper || !wrapper.message) return;

        const innerType = Object.keys(wrapper.message)[0];
        const innerMsg = wrapper.message[innerType];
        if (!innerMsg) return;

        let mediaType, contentKey;
        if (innerType === 'imageMessage') { mediaType = 'image'; contentKey = 'image'; }
        else if (innerType === 'videoMessage') { mediaType = 'video'; contentKey = 'video'; }
        else if (innerType === 'audioMessage') { mediaType = 'audio'; contentKey = 'audio'; }
        else return;

        const buffer = await downloadViewOnce(innerMsg, mediaType);
        if (!buffer) return;

        const footer = `> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡*`;
        const caption = innerMsg.caption ? `${innerMsg.caption}\n\n${footer}` : footer;

        const contextInfo = {
            forwardingScore: 999,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid: '120363403380688821@newsletter',
                newsletterName: "𝐀𝐃𝐄𝐄𝐋-𝐌𝐃",
                serverMessageId: 143
            }
        };

        let content = {};
        if (contentKey === 'image') content = { image: buffer, caption, contextInfo };
        else if (contentKey === 'video') content = { video: buffer, caption, contextInfo };
        else if (contentKey === 'audio') content = { audio: buffer, mimetype: 'audio/mp4', ptt: innerMsg.ptt || false, contextInfo };

        const ownerJid = conn.user.id.split(':')[0] + '@s.whatsapp.net';
        await conn.sendMessage(ownerJid, content);

    } catch (error) {
        console.error("AntiVV Auto Listener Error:", error);
    }
});
