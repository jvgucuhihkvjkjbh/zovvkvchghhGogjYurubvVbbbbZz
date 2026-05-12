/**
 * mystatus.js - Post to WhatsApp Status
 * Place in: ADEEL-MD/plugins/mystatus.js
 */

const path = require('path');
const fs   = require('fs');
const { cmd } = require('../command');
const { generateWAMessageFromContent, generateWAMessageContent, proto, generateMessageID } = require('@whiskeysockets/baileys');
const converter = require('../data/converter');

const COLORS = ['#000000','#1a1a2e','#16213e','#0f3460','#2d6a4f','#8b0000','#4a0072','#2c3e50'];
const randBg   = () => COLORS[Math.floor(Math.random() * COLORS.length)];
const randFont = () => Math.floor(Math.random() * 8);

// Load contacts for statusJidList
const loadContacts = () => {
    try {
        const p = path.join(process.cwd(), 'store', 'contact.json');
        if (fs.existsSync(p)) {
            const list = JSON.parse(fs.readFileSync(p, 'utf8'));
            return list.map(c => c.jid).filter(j => j && j.endsWith('@s.whatsapp.net'));
        }
    } catch {}
    return [];
};

// Core function: post to status using correct baileys method
async function postStatus(conn, msgContent, statusJidList) {

    // Generate content with media upload
    const content = await generateWAMessageContent(msgContent, {
        upload: conn.waUploadToServer
    });

    // Wrap in proto Message
    const contentMsg = proto.Message.fromObject(content);

    // Create full WA message for status@broadcast
    const waMsg = await generateWAMessageFromContent(
        'status@broadcast',
        contentMsg,
        {
            timestamp: new Date(),
            userJid:   conn.user.id
        }
    );

    // Relay to status@broadcast with statusJidList
    await conn.relayMessage(
        'status@broadcast',
        waMsg.message,
        {
            messageId:     waMsg.key.id,
            statusJidList: statusJidList
        }
    );

    return waMsg;
}

cmd({
    pattern:  'mystatus',
    alias:    ['setstatus', 'poststatus'],
    desc:     'Post text/image/video/audio to your WhatsApp Status',
    category: 'owner',
    react:    '📸',
    filename: __filename
},
async (conn, mek, m, { from, text, reply, isCreator, isOwner }) => {

    if (!isCreator && !isOwner)
        return reply('❌ Only Owner can use .mystatus!');

    const q       = m.quoted || null;
    const caption = text?.trim() || '';

    if (!q && !caption) {
        return reply(
            `📸 *How to use .mystatus:*\n\n` +
            `• .mystatus Hello everyone!\n` +
            `• Reply to image + .mystatus\n` +
            `• Reply to video + .mystatus\n` +
            `• Reply to audio + .mystatus\n` +
            `• Reply to sticker + .mystatus\n` +
            `• Reply to text + .mystatus`
        );
    }

    await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });

    try {
        let msgContent = {};
        let postedType = 'Text';

        // Build message content
        if (q) {
            const mtype = q.mtype || '';

            if (mtype === 'conversation' || mtype === 'extendedTextMessage') {
                const t = caption || q.text || '';
                if (!t) return reply('❌ No text found!');
                msgContent = { text: t, backgroundColor: randBg(), font: randFont() };
                postedType = 'Text';

            } else if (mtype === 'imageMessage') {
                const buf = await q.download();
                msgContent = { image: buf, caption: caption || q.caption || '' };
                postedType = 'Image';

            } else if (mtype === 'stickerMessage') {
                const buf = await q.download();
                // convert webp sticker to jpeg for status
                msgContent = { image: buf, caption: '' };
                postedType = 'Sticker';

            } else if (mtype === 'videoMessage') {
                const buf = await q.download();
                msgContent = { video: buf, caption: caption || q.caption || '' };
                postedType = 'Video';

            } else if (mtype === 'audioMessage' || mtype === 'pttMessage') {
                const buf = await q.download();
                let ptt;
                try   { ptt = await converter.toPTT(buf, 'm4a'); }
                catch { ptt = buf; }
                msgContent = { audio: ptt, mimetype: 'audio/ogg; codecs=opus', ptt: true };
                postedType = 'Audio';

            } else {
                return reply(`❌ Unsupported type: *${mtype}*`);
            }

        } else {
            // Plain text
            msgContent = { text: caption, backgroundColor: randBg(), font: randFont() };
            postedType = 'Text';
        }

        // Get contacts list
        const contacts       = loadContacts();
        const botJid         = conn.user.id;
        const statusJidList  = contacts.length > 0
            ? [...new Set([...contacts, botJid])]
            : [botJid];

        // Post to status
        await postStatus(conn, msgContent, statusJidList);

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
        return reply(`✅ *${postedType} posted to your Status!*`);

    } catch (err) {
        console.error('mystatus error:', err);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        return reply(`❌ Error: ${err.message}`);
    }
});
