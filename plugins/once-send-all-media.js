const converter = require('../data/converter');
const { cmd } = require('../command');
const fs = require("fs");
const { proto } = require('@whiskeysockets/baileys');

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

        const buffer = await m.quoted.download();
        if (!buffer) return;

        // Upload media to WhatsApp servers first
        let mediaMessage;
        
        if (m.quoted.mtype === 'imageMessage') {
            mediaMessage = await client.sendMessage(targetJid, {
                image: buffer,
                caption: m.quoted.text || ''
            }, { ephemeralExpiration: null });
            
            // Extract the actual image message and wrap in viewOnceMessage
            const imageMsg = mediaMessage.message.imageMessage;
            
            // Send as proper view-once using proto builder
            await client.sendMessage(targetJid, {
                viewOnceMessage: {
                    message: {
                        imageMessage: imageMsg
                    }
                }
            });
            
        } else if (m.quoted.mtype === 'videoMessage') {
            mediaMessage = await client.sendMessage(targetJid, {
                video: buffer,
                caption: m.quoted.text || ''
            }, { ephemeralExpiration: null });
            
            const videoMsg = mediaMessage.message.videoMessage;
            
            await client.sendMessage(targetJid, {
                viewOnceMessage: {
                    message: {
                        videoMessage: videoMsg
                    }
                }
            });
            
        } else if (m.quoted.mtype === 'audioMessage') {
            const ptt = await converter.toPTT(buffer, 'm4a');
            mediaMessage = await client.sendMessage(targetJid, {
                audio: ptt,
                mimetype: 'audio/ogg; codecs=opus',
                ptt: true
            }, { ephemeralExpiration: null });
            
            const audioMsg = mediaMessage.message.audioMessage;
            
            await client.sendMessage(targetJid, {
                viewOnceMessage: {
                    message: {
                        audioMessage: audioMsg
                    }
                }
            });
        }

        // Delete the original non-viewonce message if needed
        // await client.sendMessage(targetJid, { delete: mediaMessage.key });

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
