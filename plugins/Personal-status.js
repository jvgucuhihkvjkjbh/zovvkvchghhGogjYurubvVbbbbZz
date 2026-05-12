const { cmd } = require('../command');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
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
    desc:     'Post text/image/video/audio to your WhatsApp Status',
    category: 'owner',
    react:    '📸',
    filename: __filename
},
async (conn, mek, m, { from, text, reply, isCreator, isOwner, sender }) => {

    if (!isCreator && !isOwner)
        return reply('❌ Only Owner can use .mystatus!');

    try {
        const q       = m.quoted || null;
        const caption = text?.trim() || '';

        if (!q && !caption) {
            return reply(
                `📸 *How to use .mystatus:*\n\n` +
                `*1.* .mystatus Hello everyone!\n\n` +
                `*2.* Reply to any text + .mystatus\n\n` +
                `*3.* Reply to image + .mystatus (optional caption)\n\n` +
                `*4.* Reply to video + .mystatus\n\n` +
                `*5.* Reply to audio + .mystatus\n\n` +
                `*6.* Reply to sticker + .mystatus`
            );
        }

        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });

        let msgContent = {};

        if (q) {
            const mtype   = q.mtype || '';
            const msgData = q.msg || q[mtype];

            // TEXT status
            if (mtype === 'conversation' || mtype === 'extendedTextMessage') {
                const finalText = caption || q.text || '';
                if (!finalText) return reply('❌ No text found!');
                msgContent = {
                    text:            finalText,
                    backgroundColor: randBg(),
                    font:            randFont()
                };
            }

            // IMAGE, VIDEO, AUDIO, STICKER - needs mediaKey
            else {
                if (!msgData || !msgData.mediaKey) {
                    return reply('❌ Media key missing! Reply to a fresh/recent message and try again.');
                }

                const mediaTypeMap = {
                    imageMessage:   'image',
                    videoMessage:   'video',
                    audioMessage:   'audio',
                    pttMessage:     'audio',
                    stickerMessage: 'sticker',
                    documentMessage:'document'
                };

                const dlType = mediaTypeMap[mtype];
                if (!dlType) return reply(`❌ Unsupported type: ${mtype}`);

                // Download using the exact same method as working gstatus
                const stream = await downloadContentFromMessage(msgData, dlType);
                let buffer = Buffer.from([]);
                for await (const chunk of stream) {
                    buffer = Buffer.concat([buffer, chunk]);
                }

                if (mtype === 'imageMessage') {
                    msgContent = {
                        image:    buffer,
                        caption:  caption || msgData.caption || '',
                        mimetype: 'image/jpeg'
                    };
                }
                else if (mtype === 'stickerMessage') {
                    msgContent = {
                        image:    buffer,
                        caption:  caption || '',
                        mimetype: 'image/webp'
                    };
                }
                else if (mtype === 'videoMessage') {
                    msgContent = {
                        video:       buffer,
                        caption:     caption || msgData.caption || '',
                        mimetype:    'video/mp4',
                        gifPlayback: false
                    };
                }
                else if (mtype === 'audioMessage' || mtype === 'pttMessage') {
                    if ((msgData.seconds || 0) > 600)
                        return reply('❌ Audio too long! Max 10 minutes.');

                    let ptt;
                    try { ptt = await converter.toPTT(buffer, 'm4a'); }
                    catch { ptt = buffer; }

                    msgContent = {
                        audio:    ptt,
                        mimetype: 'audio/ogg; codecs=opus',
                        ptt:      true
                    };
                }
            }
        }

        // No quoted - plain text status
        else {
            msgContent = {
                text:            caption,
                backgroundColor: randBg(),
                font:            randFont()
            };
        }

        // ✅ POST TO STATUS@BROADCAST
        await conn.sendMessage(
            'status@broadcast',
            msgContent,
            { statusJidList: [conn.user.id] }
        );

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });

        const type = msgContent.image ? 'Image' :
                     msgContent.video ? 'Video' :
                     msgContent.audio ? 'Audio' : 'Text';

        return reply(`✅ *${type} posted to your Status successfully!*`);

    } catch (err) {
        console.error('mystatus error:', err);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        return reply(`❌ Failed!\n${err.message}`);
    }
});
