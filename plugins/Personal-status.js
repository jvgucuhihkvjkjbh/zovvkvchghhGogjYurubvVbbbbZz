
const fs = require('fs');
const path = require('path');
const { cmd } = require('../command');
const converter = require('../data/converter');

const COLORS = [
    '#000000', '#1a1a2e', '#16213e', '#0f3460',
    '#2d6a4f', '#8b0000', '#4a0072', '#2c3e50',
    '#e63946', '#457b9d', '#2b2d42', '#6b2737'
];
const randBg   = () => COLORS[Math.floor(Math.random() * COLORS.length)];
const randFont = () => Math.floor(Math.random() * 8);

cmd({
    pattern:  'mystatus',
    alias:    ['setstatus', 'poststatus'],
    desc:     'Post text / image / video / audio to your WhatsApp Status',
    category: 'owner',
    react:    '📸',
    filename: __filename
},
async (conn, mek, m, { from, text, reply, isCreator, isOwner }) => {

    if (!isCreator && !isOwner)
        return reply('❌ Only Owner can use .mystatus!');

    try {
        const q = m.quoted || null;
        const caption = text?.trim() || '';

        // Show help if nothing provided
        if (!q && !caption) {
            return reply(
                `📸 *How to use .mystatus:*\n\n` +
                `*1.* .mystatus Hello everyone!\n\n` +
                `*2.* Reply to any text + .mystatus\n\n` +
                `*3.* Reply to any image + .mystatus (optional caption)\n\n` +
                `*4.* Reply to any video + .mystatus\n\n` +
                `*5.* Reply to any audio + .mystatus\n\n` +
                `*6.* Reply to any sticker + .mystatus`
            );
        }

        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });

        let msgContent = {};

        if (q) {
            // m.quoted.mtype is the message type (imageMessage, videoMessage, etc.)
            const mtype = q.mtype || '';

            // TEXT quoted
            if (mtype === 'conversation' || mtype === 'extendedTextMessage') {
                const finalText = caption || q.text || '';
                if (!finalText) return reply('❌ No text found!');
                msgContent = {
                    text:            finalText,
                    backgroundColor: randBg(),
                    font:            randFont()
                };
            }

            // IMAGE
            else if (mtype === 'imageMessage') {
                const buffer = await q.download();
                msgContent = {
                    image:    buffer,
                    caption:  caption || q.caption || '',
                    mimetype: 'image/jpeg'
                };
            }

            // STICKER → post as image
            else if (mtype === 'stickerMessage') {
                const buffer = await q.download();
                msgContent = {
                    image:    buffer,
                    caption:  caption || '',
                    mimetype: 'image/webp'
                };
            }

            // VIDEO
            else if (mtype === 'videoMessage') {
                const buffer = await q.download();
                msgContent = {
                    video:       buffer,
                    caption:     caption || q.caption || '',
                    mimetype:    'video/mp4',
                    gifPlayback: false
                };
            }

            // AUDIO / PTT
            else if (mtype === 'audioMessage' || mtype === 'pttMessage') {
                if ((q.seconds || 0) > 600)
                    return reply('❌ Audio too long! Max 10 minutes.');

                const buffer = await q.download();
                const ext = (q.mimetype || '').includes('mp4') ? 'mp4' : 'm4a';
                let ptt;
                try { ptt = await converter.toPTT(buffer, ext); }
                catch { ptt = buffer; }

                msgContent = {
                    audio:    ptt,
                    mimetype: 'audio/ogg; codecs=opus',
                    ptt:      true
                };
            }

            else {
                return reply(`❌ Unsupported type: ${mtype}`);
            }
        }

        // No quoted → plain text
        else {
            msgContent = {
                text:            caption,
                backgroundColor: randBg(),
                font:            randFont()
            };
        }

        // POST TO STATUS
        await conn.sendMessage(
            'status@broadcast',
            msgContent,
            { statusJidList: [conn.user.id] }
        );

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });

        const type = msgContent.image ? 'Image' :
                     msgContent.video ? 'Video' :
                     msgContent.audio ? 'Audio' : 'Text';

        return reply(`✅ *${type} posted to your Status!*`);

    } catch (err) {
        console.error('mystatus error:', err);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        return reply(`❌ Failed!\nError: ${err.message}`);
    }
});
