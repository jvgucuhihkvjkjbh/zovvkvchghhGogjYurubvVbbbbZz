const converter = require('../data/converter');
const { cmd } = require('../command');
const fs = require("fs");
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

cmd({
    pattern: 'onceall',
    alias: ['viewonce', 'sendvv'],
    desc: 'Send media as view-once (image/video/audio)',
    category: 'media',
    react: '👁️',
    filename: __filename
}, async (client, m, message, { from, isOwner, args, sender }) => {

    if (!m.quoted) return;

    try {
        let targetJid = from;

        const input = args.join('').trim();
        const cleanInput = input.replace(/[^0-9@g.us]/g, '');

        let sudoList = [];
        if (fs.existsSync("./lib/sudo.json")) {
            sudoList = JSON.parse(fs.readFileSync("./lib/sudo.json"));
        }
        const isSudo = sudoList.includes(sender);

        if (cleanInput) {
            if (!isOwner && !isSudo) return;

            if (cleanInput.includes('@g.us')) {
                targetJid = cleanInput;
            } else if (cleanInput.length > 5) {
                const formatted = cleanInput.startsWith('0')
                    ? '92' + cleanInput.slice(1)
                    : cleanInput;
                targetJid = formatted + '@s.whatsapp.net';
            }
        }

        const quotedMsg = m.quoted;
        const buffer = await quotedMsg.download();
        if (!buffer) return;

        // Build the message content based on type
        let messageContent = null;
        
        if (quotedMsg.mtype === 'imageMessage') {
            messageContent = {
                image: buffer,
                caption: quotedMsg.text || '',
                viewOnce: true
            };
        } else if (quotedMsg.mtype === 'videoMessage') {
            messageContent = {
                video: buffer,
                caption: quotedMsg.text || '',
                viewOnce: true
            };
        } else if (quotedMsg.mtype === 'audioMessage') {
            const ptt = await converter.toPTT(buffer, 'm4a');
            messageContent = {
                audio: ptt,
                mimetype: 'audio/ogg; codecs=opus',
                ptt: true,
                viewOnce: true
            };
        }

        if (messageContent) {
            // RC10 requires sending with proper options
            await client.sendMessage(targetJid, messageContent, {
                // This option ensures view-once works correctly
                ephemeralExpiration: null,
                // For groups, ensure it's not disappearing
                disappearingMessagesInChat: false
            });
        }

        await client.sendMessage(from, {
            react: { text: "✅", key: message.key }
        });

    } catch (e) {
        console.error('VV Error:', e);
        await client.sendMessage(from, {
            text: `❌ Error: ${e.message}`
        });
    }
});
