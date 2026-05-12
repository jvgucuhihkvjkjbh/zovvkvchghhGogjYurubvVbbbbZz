const { cmd } = require('../command');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const config = require('../config');

// stream → buffer
async function toBuffer(stream) {
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
}

// random background colors for text status
const COLORS = [
    '#000000', '#1a1a2e', '#16213e', '#0f3460',
    '#2d6a4f', '#8b0000', '#4a0072', '#2c3e50',
    '#e63946', '#457b9d', '#2b2d42', '#6b2737'
];
const randBg   = () => COLORS[Math.floor(Math.random() * COLORS.length)];
const randFont = () => Math.floor(Math.random() * 8);

// ─────────────────────────────────────────────────────────────
// .mystatus command
//
// Usage:
//   .mystatus Hello World           → text status
//   Reply to text    + .mystatus   → that text as status
//   Reply to image   + .mystatus   → image status (+ optional caption)
//   Reply to video   + .mystatus   → video status
//   Reply to sticker + .mystatus   → sticker as image status
// ─────────────────────────────────────────────────────────────
cmd(
{
    pattern:  'mystatus',
    alias:    ['setstatus', 'poststatus'],
    desc:     'Post text / image / video / sticker to your WhatsApp Status',
    category: 'owner',
    react:    '📸',
    filename: __filename
},
async (conn, mek, m, { from, q, quoted, sender, isOwner, reply }) => {

    // ── Owner only ──────────────────────────────────────────
    if (!isOwner) return reply('❌ Only the *Owner* can use .mystatus!');

    await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });

    // ── Get quoted message content ──────────────────────────
    const quotedMsg = m?.quoted?.message || null;

    try {

        // ══════════════════════════════════════════
        // CASE 1 — Reply to IMAGE → image status
        // ══════════════════════════════════════════
        if (quotedMsg?.imageMessage) {
            const stream = await downloadContentFromMessage(quotedMsg.imageMessage, 'image');
            const buffer = await toBuffer(stream);
            const caption = q || quotedMsg.imageMessage.caption || '';

            await conn.sendMessage('status@broadcast', {
                image:    buffer,
                caption:  caption,
                statusJidList: [conn.user.id]
            });

            await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
            return reply('✅ *Image posted to your Status!*');
        }

        // ══════════════════════════════════════════
        // CASE 2 — Reply to VIDEO → video status
        // ══════════════════════════════════════════
        if (quotedMsg?.videoMessage) {
            const stream = await downloadContentFromMessage(quotedMsg.videoMessage, 'video');
            const buffer = await toBuffer(stream);
            const caption = q || quotedMsg.videoMessage.caption || '';

            await conn.sendMessage('status@broadcast', {
                video:    buffer,
                caption:  caption,
                gifPlayback: false,
                statusJidList: [conn.user.id]
            });

            await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
            return reply('✅ *Video posted to your Status!*');
        }

        // ══════════════════════════════════════════
        // CASE 3 — Reply to STICKER → image status
        // ══════════════════════════════════════════
        if (quotedMsg?.stickerMessage) {
            const stream = await downloadContentFromMessage(quotedMsg.stickerMessage, 'sticker');
            const buffer = await toBuffer(stream);

            await conn.sendMessage('status@broadcast', {
                image:    buffer,
                caption:  q || '',
                statusJidList: [conn.user.id]
            });

            await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
            return reply('✅ *Sticker posted to your Status!*');
        }

        // ══════════════════════════════════════════
        // CASE 4 — Reply to TEXT → text status
        // ══════════════════════════════════════════
        if (quotedMsg) {
            const textFromQuoted =
                quotedMsg.conversation ||
                quotedMsg.extendedTextMessage?.text ||
                quotedMsg.imageMessage?.caption ||
                quotedMsg.videoMessage?.caption || '';

            const finalText = q || textFromQuoted;

            if (!finalText) {
                await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
                return reply('⚠️ No text found in the quoted message!');
            }

            await conn.sendMessage('status@broadcast', {
                text:            finalText,
                backgroundColor: randBg(),
                font:            randFont(),
                statusJidList:   [conn.user.id]
            });

            await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
            return reply(`✅ *Text posted to your Status!*\n\n> "${finalText.slice(0, 80)}${finalText.length > 80 ? '...' : ''}"`);
        }

        // ══════════════════════════════════════════
        // CASE 5 — No reply, just text after command
        // ══════════════════════════════════════════
        if (q && q.trim()) {
            await conn.sendMessage('status@broadcast', {
                text:            q.trim(),
                backgroundColor: randBg(),
                font:            randFont(),
                statusJidList:   [conn.user.id]
            });

            await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
            return reply(`✅ *Text posted to your Status!*\n\n> "${q.trim().slice(0, 80)}${q.trim().length > 80 ? '...' : ''}"`);
        }

        // ══════════════════════════════════════════
        // CASE 6 — Nothing provided → show help
        // ══════════════════════════════════════════
        await conn.sendMessage(from, { react: { text: '❓', key: mek.key } });
        return reply(
            `📸 *How to use .mystatus:*\n\n` +
            `*1.* Text status:\n\`\`\`.mystatus Hello everyone!\`\`\`\n\n` +
            `*2.* Reply to any text + \`.mystatus\`\n\n` +
            `*3.* Reply to any image + \`.mystatus optional caption\`\n\n` +
            `*4.* Reply to any video + \`.mystatus optional caption\`\n\n` +
            `*5.* Reply to any sticker + \`.mystatus\``
        );

    } catch (err) {
        console.error('mystatus error:', err);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        return reply(`❌ *Failed!*\nError: ${err.message}`);
    }
});
