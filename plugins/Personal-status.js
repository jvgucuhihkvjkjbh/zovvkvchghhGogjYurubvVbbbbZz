const fs = require('fs');
const path = require('path');
const { cmd } = require('../command');
const converter = require('../data/converter');

// ─────────────────────────────────────────────────────────────
// .mystatus — Post anything to YOUR WhatsApp Status
//
// Usage:
//   .mystatus Hello World            → text status
//   Reply to text    + .mystatus    → that text as status  
//   Reply to image   + .mystatus    → image status
//   Reply to image   + .mystatus caption → image + caption
//   Reply to video   + .mystatus    → video status
//   Reply to audio   + .mystatus    → audio status (PTT)
//   Reply to sticker + .mystatus    → sticker as image status
//
// Works from: group, personal chat, anywhere
// Owner only
// ─────────────────────────────────────────────────────────────

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

// Random bg colors for text status
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
async (conn, mek, m, { from, text, reply, isCreator, sender }) => {

    // ── Owner only ─────────────────────────────────────────
    if (!isAuthorized(sender, isCreator))
        return reply('❌ This command is only for the Owner!');

    try {
        const quotedMsg = m.quoted;
        const mimeType  = quotedMsg ? (quotedMsg.msg || quotedMsg).mimetype || '' : '';
        const caption   = text?.trim() || '';

        // Nothing provided → show help
        if (!quotedMsg && !caption) {
            return reply(
                `📸 *How to use .mystatus:*\n\n` +
                `*1.* Text status:\n.mystatus Hello everyone!\n\n` +
                `*2.* Reply to any text + .mystatus\n\n` +
                `*3.* Reply to any image + .mystatus (optional caption)\n\n` +
                `*4.* Reply to any video + .mystatus (optional caption)\n\n` +
                `*5.* Reply to any audio + .mystatus\n\n` +
                `*6.* Reply to any sticker + .mystatus`
            );
        }

        // Loading react
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });

        let messageContent = {};

        // ══════════════════════════════════════════════════
        // Has quoted media → download and post to status
        // ══════════════════════════════════════════════════
        if (quotedMsg) {
            const mediaBuffer = await quotedMsg.download();
            if (!mediaBuffer) throw new Error('Failed to download media. Try again.');

            // ── IMAGE ───────────────────────────────────
            if (
                mimeType.startsWith('image/') ||
                quotedMsg.mtype === 'imageMessage' ||
                Object.keys(quotedMsg.message || {})[0] === 'imageMessage'
            ) {
                messageContent = {
                    image:   mediaBuffer,
                    caption: caption || quotedMsg.msg?.caption || '',
                    mimetype: mimeType || 'image/jpeg'
                };
            }

            // ── STICKER → send as image ──────────────────
            else if (
                quotedMsg.mtype === 'stickerMessage' ||
                Object.keys(quotedMsg.message || {})[0] === 'stickerMessage'
            ) {
                messageContent = {
                    image:   mediaBuffer,
                    caption: caption || '',
                    mimetype: 'image/webp'
                };
            }

            // ── VIDEO ───────────────────────────────────
            else if (
                mimeType.startsWith('video/') ||
                quotedMsg.mtype === 'videoMessage' ||
                Object.keys(quotedMsg.message || {})[0] === 'videoMessage'
            ) {
                messageContent = {
                    video:   mediaBuffer,
                    caption: caption || quotedMsg.msg?.caption || '',
                    mimetype: mimeType || 'video/mp4',
                    gifPlayback: false
                };
            }

            // ── AUDIO / PTT ──────────────────────────────
            else if (
                mimeType.startsWith('audio/') ||
                quotedMsg.mtype === 'audioMessage' ||
                quotedMsg.mtype === 'pttMessage' ||
                Object.keys(quotedMsg.message || {})[0] === 'audioMessage'
            ) {
                const duration = quotedMsg.msg?.seconds || 0;
                if (duration > 600)
                    return reply('❌ Audio too long! Max 10 minutes allowed.');

                const ext = mimeType.includes('mp4') ? 'mp4' : 'm4a';
                let pttBuffer;
                try {
                    pttBuffer = await converter.toPTT(mediaBuffer, ext);
                } catch {
                    pttBuffer = mediaBuffer;
                }

                messageContent = {
                    audio:    pttBuffer,
                    mimetype: 'audio/ogg; codecs=opus',
                    ptt:      true
                };
            }

            // ── TEXT quoted → post text as status ────────
            else {
                const quotedText =
                    quotedMsg.msg?.conversation ||
                    quotedMsg.msg?.text ||
                    quotedMsg.message?.conversation ||
                    quotedMsg.message?.extendedTextMessage?.text ||
                    '';

                const finalText = caption || quotedText;
                if (!finalText)
                    return reply('❌ Could not extract text from quoted message!');

                messageContent = {
                    text:            finalText,
                    backgroundColor: randBg(),
                    font:            randFont()
                };
            }
        }

        // ══════════════════════════════════════════════════
        // No quoted msg → plain text status
        // ══════════════════════════════════════════════════
        else if (caption) {
            messageContent = {
                text:            caption,
                backgroundColor: randBg(),
                font:            randFont()
            };
        }

        // ── Send to status@broadcast ─────────────────────
        await conn.sendMessage(
            'status@broadcast',
            messageContent,
            { statusJidList: [conn.user.id] }
        );

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });

        const typePosted =
            messageContent.image ? 'Image' :
            messageContent.video ? 'Video' :
            messageContent.audio ? 'Audio' : 'Text';

        return reply(`✅ *${typePosted} posted to your Status successfully!*`);

    } catch (error) {
        console.error('mystatus error:', error);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        return reply(`❌ *Failed!*\nError: ${error.message}`);
    }
});
