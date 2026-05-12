const path = require('path');
const { cmd } = require('../command');
const converter = require('../data/converter');

// contacts store - same as bot uses internally
const storeDir = path.join(process.cwd(), 'store');
const fs = require('fs');

const getStatusJidList = async (conn) => {
    try {
        // Get contacts from store/contact.json (same file bot saves contacts in)
        const filePath = path.join(storeDir, 'contact.json');
        if (fs.existsSync(filePath)) {
            const contacts = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const jids = contacts
                .map(c => c.jid)
                .filter(j => j && j.endsWith('@s.whatsapp.net'));
            if (jids.length > 0) {
                // always include bot itself
                if (!jids.includes(conn.user.id)) jids.push(conn.user.id);
                return jids;
            }
        }
    } catch (e) {
        console.log('getStatusJidList error:', e.message);
    }
    // fallback - bot only
    return [conn.user.id];
};

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

        // Get full contacts list for statusJidList
        const statusJidList = await getStatusJidList(conn);

        let msgContent = {};
        let postedType = 'Text';

        if (q) {
            const mtype = q.mtype || '';

            // TEXT
            if (mtype === 'conversation' || mtype === 'extendedTextMessage') {
                const finalText = caption || q.text || '';
                if (!finalText) return reply('❌ No text found!');
                msgContent = {
                    text:            finalText,
                    backgroundColor: randBg(),
                    font:            randFont()
                };
                postedType = 'Text';
            }

            // IMAGE
            else if (mtype === 'imageMessage') {
                const buffer = await q.download();
                msgContent = {
                    image:    buffer,
                    caption:  caption || q.caption || q.text || '',
                    mimetype: 'image/jpeg'
                };
                postedType = 'Image';
            }

            // STICKER → as image
            else if (mtype === 'stickerMessage') {
                const buffer = await q.download();
                msgContent = {
                    image:    buffer,
                    caption:  caption || '',
                    mimetype: 'image/webp'
                };
                postedType = 'Sticker';
            }

            // VIDEO
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

            // AUDIO / PTT
            else if (mtype === 'audioMessage' || mtype === 'pttMessage') {
                if ((q.seconds || q.duration || 0) > 600)
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

            else {
                return reply(`❌ Unsupported type: *${mtype}*`);
            }
        }

        // plain text
        else {
            msgContent = {
                text:            caption,
                backgroundColor: randBg(),
                font:            randFont()
            };
            postedType = 'Text';
        }

        // POST TO STATUS with full contacts list
        await conn.sendMessage(
            'status@broadcast',
            msgContent,
            { statusJidList }
        );

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
        return reply(
            `✅ *${postedType} posted to your Status!*\n` +
            `👥 Visible to ${statusJidList.length} contact(s)`
        );

    } catch (err) {
        console.error('mystatus error:', err);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        return reply(`❌ Error: ${err.message}`);
    }
});
