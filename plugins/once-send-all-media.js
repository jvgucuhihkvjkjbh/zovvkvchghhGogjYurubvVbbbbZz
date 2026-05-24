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
        let cleanInput = input.replace(/[\s\+\-]/g, '').replace(/[^0-9@g.us]/g, '');

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
                let num = cleanInput.replace(/[^0-9]/g, '');
                if (num.startsWith('0')) num = '92' + num.slice(1);
                targetJid = num + '@s.whatsapp.net';
            }
        }

        await client.sendMessage(from, { text: `🔍 Debug:\nmtype: ${m.quoted.mtype}\ntargetJid: ${targetJid}\ninput: "${input}"` });

        const buffer = await m.quoted.download();
        if (!buffer) return await client.sendMessage(from, { text: '❌ Buffer empty' });

        await client.sendMessage(from, { text: `✅ Buffer ready: ${buffer.length} bytes` });

        if (m.quoted.mtype === 'imageMessage') {
            await client.sendMessage(targetJid, {
                image: buffer,
                caption: m.quoted.text || '',
                viewOnce: true
            });

        } else if (m.quoted.mtype === 'videoMessage') {
            await client.sendMessage(targetJid, {
                video: buffer,
                caption: m.quoted.text || '',
                viewOnce: true
            });

        } else if (m.quoted.mtype === 'audioMessage') {
            const ptt = await converter.toPTT(buffer, 'm4a');
            await client.sendMessage(targetJid, {
                audio: ptt,
                mimetype: 'audio/ogg; codecs=opus',
                ptt: true,
                viewOnce: true
            });

        } else {
            return await client.sendMessage(from, { text: `❌ Unsupported type: ${m.quoted.mtype}` });
        }

        await client.sendMessage(from, { react: { text: "✅", key: message.key } });

    } catch (e) {
        console.error('VV Error:', e);
        await client.sendMessage(from, {
            text: `❌ *Error:*\n${e.message}\n\nStack: ${e.stack?.substring(0, 200)}`
        });
    }
});
