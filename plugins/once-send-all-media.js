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
                let num = cleanInput.replace(/[^0-9]/g, '');
                if (num.startsWith('0')) num = '92' + num.slice(1);
                targetJid = `${num}@s.whatsapp.net`;
            }
        }

        // buffer download
        const buffer = await m.quoted.download();
        if (!buffer) return await client.sendMessage(from, { text: '❌ میڈیا ڈاؤنلوڈ نہیں ہوئی' });

        // forward کمانڈ والا sending structure
        let messageContent = {};

        if (m.quoted.mtype === 'imageMessage') {
            messageContent = {
                image: buffer,
                caption: m.quoted.text || m.quoted.caption || '',
                mimetype: m.quoted.mimetype || 'image/jpeg',
                viewOnce: true
            };
        } else if (m.quoted.mtype === 'videoMessage') {
            messageContent = {
                video: buffer,
                caption: m.quoted.text || m.quoted.caption || '',
                mimetype: m.quoted.mimetype || 'video/mp4',
                viewOnce: true
            };
        } else if (m.quoted.mtype === 'audioMessage') {
            const ptt = await converter.toPTT(buffer, 'm4a');
            messageContent = {
                audio: ptt,
                mimetype: 'audio/ogg; codecs=opus',
                ptt: m.quoted.ptt || true,
                viewOnce: true
            };
        } else {
            return await client.sendMessage(from, { text: '❌ صرف image، video یا audio reply کریں' });
        }

        // forward کمانڈ کی طرح send کریں
        await client.sendMessage(targetJid, messageContent);

        await client.sendMessage(from, {
            react: { text: "✅", key: message.key }
        });

    } catch (e) {
        console.error('VV Error:', e);
        await client.sendMessage(from, {
            text: `❌ *Error:*\n\`\`\`${e.message}\`\`\``
        });
    }
});
