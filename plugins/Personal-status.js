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
    desc:     'Post text/image/video/audio to your WhatsApp Status',
    category: 'owner',
    react:    '📸',
    filename: __filename
},
async (conn, mek, m, { from, text, reply, isCreator, isOwner }) => {

    if (!isCreator && !isOwner)
        return reply('❌ Only Owner can use .mystatus!');

    try {
        const q       = m.quoted || null;
        const caption = text?.trim() || '';

        // Show help
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
        let postedType = 'Text';

        if (q) {
            const mtype = q.mtype || '';

            // ── TEXT ─────────────────────────────────────────
            if (mtype === 'conversation' || mtype === 'extendedTextMessage') {
                const finalText = caption || q.text || '';
                if (!finalText) return reply('❌ No text found in quoted message!');
                msgContent = {
                    text:            finalText,
                    backgroundColor: randBg(),
                    font:            randFont()
                };
                postedType = 'Text';
            }

            // ── IMAGE ────────────────────────────────────────
            else if (mtype === 'imageMessage') {
                // m.quoted.download() = conn.downloadMediaMessage(m.quoted)
                // conn.downloadMediaMessage uses m.quoted directly with mtype
                const buffer = await q.download();
                msgContent = {
                    image:    buffer,
                    caption:  caption || q.caption || q.text || '',
                    mimetype: 'image/jpeg'
                };
                postedType = 'Image';
            }

            // ── STICKER → post as image ──────────────────────
            else if (mtype === 'stickerMessage') {
                const buffer = await q.download();
                msgContent = {
                    image:    buffer,
                    caption:  caption || '',
                    mimetype: 'image/webp'
                };
                postedType = 'Sticker';
            }

            // ── VIDEO ────────────────────────────────────────
            else if (mtype === 'videoMessage') {
                const buffer = await q.download();
                msgContent = {
                    video:       buffer,
                    caption:     caption || q.caption || q.text || '',
                    mimetype:    'video/mp4',
                    gifPlayback: false
                };
                postedType = 'Video';
            }

            // ── AUDIO / PTT ──────────────────────────────────
            else if (mtype === 'audioMessage' || mtype === 'pttMessage') {
                const duration = q.seconds || q.duration || 0;
                if (duration > 600)
                    return reply('❌ Audio too long! Max 10 minutes.');

                const buffer = await q.download();
                let ptt;
                try   { ptt = await converter.toPTT(buffer, 'm4a'); }
                catch { ptt = buffer; }

                msgContent = {
                    audio:    ptt,
                    mimetype: 'audio/ogg; codecs=opus',
                    ptt:      true
                };
                postedType = 'Audio';
            }

            // ── Unknown type ─────────────────────────────────
            else {
                return reply(`❌ Unsupported media type: *${mtype}*\nSupported: image, video, audio, sticker, text`);
            }
        }

        // ── No quoted → plain text status ───────────────────
        else {
            msgContent = {
                text:            caption,
                backgroundColor: randBg(),
                font:            randFont()
            };
            postedType = 'Text';
        }

        // ── Try Method 1: status@broadcast ───────────────────
        let posted = false;
        try {
            await conn.sendMessage(
                'status@broadcast',
                msgContent,
                { statusJidList: [conn.user.id] }
            );
            posted = true;
        } catch (e1) {
            console.log('Method 1 failed:', e1.message);
        }

        // ── Try Method 2: direct if method 1 failed ──────────
        if (!posted) {
            try {
                await conn.sendMessage('status@broadcast', msgContent);
                posted = true;
            } catch (e2) {
                console.log('Method 2 failed:', e2.message);
            }
        }

        // ── Try Method 3: updateProfileStatus for text only ──
        if (!posted && msgContent.text) {
            try {
                await conn.updateProfileStatus(msgContent.text);
                posted = true;
            } catch (e3) {
                console.log('Method 3 failed:', e3.message);
            }
        }

        if (posted) {
            await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
            return reply(`✅ *${postedType} posted to your Status successfully!*`);
        } else {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
            return reply(`❌ All methods failed. Make sure bot has status permission in WhatsApp privacy settings.`);
        }

    } catch (err) {
        console.error('mystatus error:', err);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        return reply(`❌ Error: ${err.message}`);
    }
});
