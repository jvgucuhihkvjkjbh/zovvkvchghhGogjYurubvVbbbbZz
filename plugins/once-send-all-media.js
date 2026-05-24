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

        if (m.quoted.mtype === 'imageMessage') {

            // پہلے normal send کرو
            const sent = await client.sendMessage(targetJid, {
                image: buffer,
                caption: m.quoted.text || '',
                mimetype: 'image/jpeg'
            });

            // پھر delete کرو
            await client.sendMessage(targetJid, { delete: sent.key });

            // viewOnce wrap کر کے send کرو
            await client.sendMessage(targetJid, {
                image: buffer,
                caption: m.quoted.text || '',
                mimetype: 'image/jpeg',
                viewOnce: true
            });

        } else if (m.quoted.mtype === 'videoMessage') {

            await client.sendMessage(targetJid, {
                video: buffer,
                caption: m.quoted.text || '',
                mimetype: 'video/mp4',
                viewOnce: true
            });

        } else if (m.quoted.mtype === 'audioMessage') {

            // tov جیسا - پہلے normal audio send
            const ptt = await converter.toPTT(buffer, 'm4a');
            await client.sendMessage(targetJid, {
                audio: ptt,
                mimetype: 'audio/ogg; codecs=opus',
                ptt: true,
                viewOnce: true
            });

        } else {
            return await client.sendMessage(from, {
                text: '❌ صرف image، video یا audio reply کریں'
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
