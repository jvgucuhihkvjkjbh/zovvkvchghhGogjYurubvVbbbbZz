const path = require('path');
const fs   = require('fs');
const { cmd } = require('../command');
const { generateWAMessageContent, proto } = require('@whiskeysockets/baileys');
const converter = require('../data/converter');

const COLORS = ['#000000','#1a1a2e','#16213e','#0f3460','#2d6a4f','#8b0000','#4a0072','#2c3e50','#e63946','#457b9d','#2b2d42','#6b2737'];
const randBg   = () => COLORS[Math.floor(Math.random() * COLORS.length)];
const randFont = () => Math.floor(Math.random() * 8);
const randID   = () => Array.from({length:16}, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random()*62)]).join('');

const getContacts = () => {
    try {
        const p = path.join(process.cwd(), 'store', 'contact.json');
        if (!fs.existsSync(p)) return [];
        return JSON.parse(fs.readFileSync(p, 'utf8')).map(c => c.jid).filter(j => j?.endsWith('@s.whatsapp.net'));
    } catch { return []; }
};

cmd({
    pattern:  'mystatus',
    alias:    ['setstatus','poststatus'],
    desc:     'Post text/image/video/audio to your WhatsApp Status',
    category: 'owner',
    react:    '📸',
    filename: __filename
},
async (conn, mek, m, { from, text, reply, isCreator, isOwner }) => {

    if (!isCreator && !isOwner) return reply('❌ Only Owner can use .mystatus!');

    const q       = m.quoted || null;
    const caption = text?.trim() || '';

    if (!q && !caption) return reply(
        `📸 *How to use .mystatus:*\n\n` +
        `*1.* .mystatus Hello everyone!\n` +
        `*2.* Reply to text + .mystatus\n` +
        `*3.* Reply to image + .mystatus\n` +
        `*4.* Reply to video + .mystatus\n` +
        `*5.* Reply to audio + .mystatus\n` +
        `*6.* Reply to sticker + .mystatus`
    );

    await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });

    try {
        let msgContent = {};
        let postedType = 'Text';

        if (q) {
            const mtype = q.mtype || '';

            if (mtype === 'conversation' || mtype === 'extendedTextMessage') {
                const t = caption || q.text || '';
                if (!t) return reply('❌ No text found!');
                msgContent = { text: t, backgroundColor: randBg(), font: randFont() };

            } else if (mtype === 'imageMessage') {
                msgContent = { image: await q.download(), caption: caption || q.caption || '', mimetype: 'image/jpeg' };
                postedType = 'Image';

            } else if (mtype === 'stickerMessage') {
                msgContent = { image: await q.download(), caption: '', mimetype: 'image/webp' };
                postedType = 'Sticker';

            } else if (mtype === 'videoMessage') {
                msgContent = { video: await q.download(), caption: caption || q.caption || '', mimetype: 'video/mp4', gifPlayback: false };
                postedType = 'Video';

            } else if (mtype === 'audioMessage' || mtype === 'pttMessage') {
                const buf = await q.download();
                let ptt; try { ptt = await converter.toPTT(buf,'m4a'); } catch { ptt = buf; }
                msgContent = { audio: ptt, mimetype: 'audio/ogg; codecs=opus', ptt: true };
                postedType = 'Audio';

            } else return reply(`❌ Unsupported type: *${mtype}*`);

        } else {
            msgContent = { text: caption, backgroundColor: randBg(), font: randFont() };
        }

        // Build contacts list for statusJidList
        const contacts = getContacts();
        const botJid   = conn.user.id;
        const statusJidList = [...new Set([...contacts, botJid])];

        // Generate message content with upload
        const content = await generateWAMessageContent(msgContent, {
            upload: conn.waUploadToServer
        });

        const msgId = randID();

        // relayMessage to status@broadcast — this is the CORRECT baileys way
        await conn.relayMessage('status@broadcast', content, {
            messageId:     msgId,
            statusJidList: statusJidList,
            additionalAttributes: { category: 'status', edit: '0' }
        });

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
        return reply(`✅ *${postedType} posted to your Status!*`);

    } catch (err) {
        console.error('mystatus error:', err);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        return reply(`❌ Error: ${err.message}`);
    }
});
