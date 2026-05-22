const converter = require('../data/converter');
const { cmd } = require('../command');
const { jidNormalizedUser } = require('@whiskeysockets/baileys');
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

        const input = args.join('').trim();
        const cleanInput = input.replace(/[^0-9@g.us]/g, '');

        let sudoList = [];
        if (fs.existsSync("./lib/sudo.json")) {
            sudoList = JSON.parse(fs.readFileSync("./lib/sudo.json"));
        }

        const normalize = (id) => id.replace(/[^0-9]/g, '');
        const isSudo = sudoList.map(normalize).includes(normalize(sender));

        if (cleanInput) {

            if (!isOwner && !isSudo) return;

            if (cleanInput.includes('@g.us')) {
                targetJid = cleanInput;
            } else if (cleanInput.length > 5) {
                const formatted =
                    cleanInput.startsWith('0')
                        ? '92' + cleanInput.slice(1)
                        : cleanInput;

                targetJid = jidNormalizedUser(formatted + '@s.whatsapp.net');
            }
        }

        const buffer = await m.quoted.download();
        if (!buffer) return;

        // RC10: پہلے session assert کریں
        try {
            await client.assertSessions([targetJid], false);
        } catch (e) {
            console.log('Session assert skipped:', e.message);
        }

        if (m.quoted.mtype === 'imageMessage') {
            await client.sendMessage(targetJid, {
                image: buffer,
                caption: m.quoted.caption || '',
                viewOnce: true
            });
        }
        else if (m.quoted.mtype === 'videoMessage') {
            await client.sendMessage(targetJid, {
                video: buffer,
                caption: m.quoted.caption || '',
                viewOnce: true
            });
        }
        else if (m.quoted.mtype === 'audioMessage') {
            const ptt = await converter.toPTT(buffer, 'm4a');
            await client.sendMessage(targetJid, {
                audio: ptt,
                mimetype: 'audio/ogg; codecs=opus',
                ptt: true,
                viewOnce: true
            });
        }
        else {
            return;
        }

        await client.sendMessage(from, {
            react: { text: "✅", key: message.key }
        });

    } catch (e) {
        console.error('VV Error:', e);
    }

});
