const converter = require('../data/converter');
const { cmd } = require('../command');
const fs = require("fs");

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

        const input = args.join(' ').trim();

        let sudoList = [];

        if (fs.existsSync("./lib/sudo.json")) {
            sudoList = JSON.parse(fs.readFileSync("./lib/sudo.json"));
        }

        const normalize = (id) => id.replace(/[^0-9]/g, '');
        const isSudo = sudoList.map(normalize).includes(normalize(sender));

        if (input) {

            if (!isOwner && !isSudo) return;

            // Group ID
            if (input.includes('@g.us')) {

                targetJid = input.trim();
            }

            // Number
            else {

                let number = input.replace(/[^0-9]/g, '');

                if (number.startsWith('0')) {
                    number = '92' + number.slice(1);
                }

                if (!number.startsWith('92')) {
                    number = '92' + number;
                }

                targetJid = number + '@s.whatsapp.net';
            }
        }

        const buffer = await m.quoted.download();

        if (!buffer) {
            return await client.sendMessage(from, {
                text: "❌ Failed to download quoted media"
            }, { quoted: message });
        }

        let msg = {};

        // Image
        if (
            m.quoted.mtype === 'imageMessage' ||
            m.quoted.type === 'imageMessage'
        ) {

            msg = {
                image: buffer,
                caption: m.quoted.caption || '',
                viewOnce: true
            };
        }

        // Video
        else if (
            m.quoted.mtype === 'videoMessage' ||
            m.quoted.type === 'videoMessage'
        ) {

            msg = {
                video: buffer,
                caption: m.quoted.caption || '',
                viewOnce: true
            };
        }

        // Audio
        else if (
            m.quoted.mtype === 'audioMessage' ||
            m.quoted.type === 'audioMessage'
        ) {

            const ptt = await converter.toPTT(buffer, 'mp3');

            msg = {
                audio: ptt,
                mimetype: 'audio/ogg; codecs=opus',
                ptt: true,
                viewOnce: true
            };
        }

        else {
            return await client.sendMessage(from, {
                text: "❌ Unsupported media type"
            }, { quoted: message });
        }

        // Send message
        await client.sendMessage(targetJid, msg);

        // Success react
        await client.sendMessage(from, {
            react: {
                text: "✅",
                key: message.key
            }
        });

    } catch (e) {

        console.error('VV Error:', e);

        await client.sendMessage(from, {
            text: `❌ ${e.message}`
        }, { quoted: message });
    }

});
