const converter = require('../data/converter');
const { cmd } = require('../command');
const fs = require("fs");

cmd({
    pattern: 'tov',
    alias: ['voice', 'tovoice'],
    desc: 'Convert media to voice message',
    category: 'audio',
    react: '🎙️',
    filename: __filename
}, async (client, m, message, { from, isOwner, args, sender }) => {

    if (!m.quoted) return;

    try {

        let targetJid = from;

        const input = args.join('').trim();

        let sudoList = [];
        if (fs.existsSync("./lib/sudo.json")) {
            sudoList = JSON.parse(fs.readFileSync("./lib/sudo.json"));
        }
        const isSudo = sudoList.includes(sender);

        if (input) {
            if (!isOwner && !isSudo) return;

            if (input.includes('@g.us')) {
                targetJid = input.trim();

            } else {
                const numberOnly = input.replace(/[^0-9]/g, '');
                if (numberOnly.length > 5) {
                    const formatted = numberOnly.startsWith('0')
                        ? '92' + numberOnly.slice(1)
                        : numberOnly;

                    const pnJid = formatted + '@s.whatsapp.net';

                    // ✅ RC10 صحیح طریقہ - onWhatsApp سے LID fetch
                    try {
                        const [result] = await client.onWhatsApp(pnJid);
                        if (result?.exists && result?.jid) {
                            targetJid = result.jid; // LID یا PN جو بھی ملے
                        } else {
                            targetJid = pnJid;
                        }
                    } catch {
                        // onWhatsApp fail ہو تو lidMapping try کرو
                        try {
                            const lid = await client.signalRepository.lidMapping.getLIDForPN(pnJid);
                            targetJid = lid || pnJid;
                        } catch {
                            targetJid = pnJid;
                        }
                    }
                }
            }
        }

        const buffer = await m.quoted.download();
        if (!buffer) return;

        const ext =
            m.quoted.mtype === 'videoMessage' ? 'mp4' :
            m.quoted.mtype === 'audioMessage' ? 'm4a' :
            null;

        if (!ext) return;

        if (m.quoted.seconds && m.quoted.seconds > 600) return;

        const ptt = await converter.toPTT(buffer, ext);

        await client.sendMessage(targetJid, {
            audio: ptt,
            mimetype: 'audio/ogg; codecs=opus',
            ptt: true
        });

        await client.sendMessage(from, {
            react: { text: "✅", key: message.key }
        });

    } catch (e) {
        console.error('PTT Error:', e);
    }

});
