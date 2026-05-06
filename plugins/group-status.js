const fs = require('fs');
const path = require('path');
const { cmd } = require('../command');
const converter = require('../data/converter');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

const OWNER_PATH = path.join(__dirname, "../lib/sudo.json");

const loadSudo = () => {
    try {
        return JSON.parse(fs.readFileSync(OWNER_PATH, "utf-8"));
    } catch {
        return [];
    }
};

const isAuthorized = (sender, isCreator) => {
    if (isCreator) return true;
    const sudoOwners = loadSudo();
    return sudoOwners.some(owner => owner === sender);
};

cmd({
    pattern: "gstatus",
    alias: ["groupstatus", "gcstatus"],
    desc: "Post group status with media or text",
    category: "group",
    react: "📢",
    filename: __filename
}, async (conn, mek, m, { from, text, reply, isCreator, isGroup, sender }) => {

    if (!isAuthorized(sender, isCreator)) return reply("❌ This command is only for owners!");
    if (!isGroup) return reply("❌ This command can only be used in groups!");

    try {
        const quotedMsg = m.quoted ? m.quoted : null;
        const caption = text?.trim() || "";

        if (!quotedMsg && !caption) {
            return reply("⚠️ Reply to media or provide text!");
        }

        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

        const groupMetadata = await conn.groupMetadata(from);
        const mentionedJid = groupMetadata.participants.map(p => p.id);
        let messageContent = {};

        if (quotedMsg) {
            const mtype = quotedMsg.mtype || Object.keys(quotedMsg.message || {})[0];
            const msgData = quotedMsg.msg || quotedMsg[mtype];
            
            if (!msgData || !msgData.mediaKey) {
                return reply("❌ Media key missing! Try replying to a fresh message.");
            }

            const stream = await downloadContentFromMessage(msgData, mtype.replace('Message', ''));
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }

            const contextInfo = { mentionedJid };

            if (mtype === 'imageMessage') {
                messageContent = { image: buffer, caption: caption || msgData.caption || "", contextInfo };
            } else if (mtype === 'videoMessage') {
                messageContent = { video: buffer, caption: caption || msgData.caption || "", contextInfo };
            } else if (mtype === 'audioMessage' || mtype === 'pttMessage') {
                let pttBuffer;
                try {
                    pttBuffer = await converter.toPTT(buffer, 'm4a');
                } catch {
                    pttBuffer = buffer;
                }
                messageContent = { audio: pttBuffer, mimetype: 'audio/ogg; codecs=opus', ptt: true, contextInfo };
            } else {
                return reply("❌ Unsupported media type!");
            }
        } else {
            messageContent = { text: caption, contextInfo: { mentionedJid } };
        }

        await conn.sendMessage(from, messageContent, { quoted: mek });
        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });

    } catch (error) {
        console.error(error);
        reply(`❌ Error: ${error.message}`);
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
    }
});
