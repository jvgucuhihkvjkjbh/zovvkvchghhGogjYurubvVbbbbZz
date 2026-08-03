const { cmd } = require('../command');
const config = require('../config');

cmd({
    on: "body"
},
async (conn, mek, m, { from }) => {
    try {
        const isEnabled = config.AUTO_VV === "true" || global.autoVVStatus === "true";
        if (!isEnabled) return;
        if (!m.quoted && !m.viewOnce) return;

        const target = m.viewOnce ? m : m.quoted;
        if (!target || !target.viewOnce) return;

        const buffer = await target.download();
        if (!buffer) return;

        const footer = `> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡*`;
        const text = (target.text || target.caption || target.body || "").trim();
        const caption = text.length > 0 ? `${text}\n\n${footer}` : `${footer}`;

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

        if (target.mtype === "imageMessage") {
            content = { image: buffer, caption, contextInfo };
        } else if (target.mtype === "videoMessage") {
            content = { video: buffer, caption, contextInfo };
        } else if (target.mtype === "audioMessage") {
            content = { audio: buffer, mimetype: "audio/mp4", ptt: target.ptt || false, contextInfo };
        } else {
            return;
        }

        const ownerJid = conn.user.id.split(':')[0] + '@s.whatsapp.net';
        await conn.sendMessage(ownerJid, content);

    } catch (error) {
        console.error("AutoViewOnce Listener Error:", error);
    }
});
