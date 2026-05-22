const converter = require('../data/converter');
const { cmd } = require('../command');
const fs = require("fs");

cmd({
    pattern: 'tov2',
    alias: ['voice2', 'tovoice2'],
    desc: 'Convert media to voice message',
    category: 'audio',
    react: '🎙️',
    filename: __filename
}, async (client, m, message, { from, isOwner, args, sender, reply }) => {

    try {

        const quoted = m.quoted;

        if (!quoted) {
            return reply("❌ Reply to audio/video");
        }

        let targetJid = from;

        const input = args.join(' ').trim();

        // OWNER / SUDO CHECK
        if (input) {

            let sudoList = [];

            if (fs.existsSync("./lib/sudo.json")) {
                sudoList = JSON.parse(fs.readFileSync("./lib/sudo.json"));
            }

            const normalize = (id) =>
                id.replace(/[^0-9]/g, '');

            const isSudo = sudoList
                .map(normalize)
                .includes(normalize(sender));

            if (!isOwner && !isSudo) {
                return reply("❌ Owner only");
            }

            // GROUP ID
            if (input.includes('@g.us')) {

                targetJid = input.trim();
            }

            // NUMBER
            else {

                let number = input.replace(/[^0-9]/g, '');

                if (number.startsWith('0')) {
                    number = '92' + number.slice(1);
                }

                if (!number.startsWith('92')) {
                    number = '92' + number;
                }

                const jid = number + '@s.whatsapp.net';

                try {

                    const check =
                        await client.onWhatsApp(jid);

                    if (!check || !check.length) {
                        return reply("❌ User not found");
                    }

                    targetJid = check[0].jid;

                } catch {

                    targetJid = jid;
                }
            }
        }

        await client.sendMessage(from, {
            react: {
                text: "⏳",
                key: message.key
            }
        });

        // DOWNLOAD MEDIA
        const buffer = await quoted.download();

        if (!buffer) {
            return reply("❌ Failed to download media");
        }

        const mime =
            quoted.mimetype ||
            quoted.msg?.mimetype ||
            '';

        let ext = null;

        // VIDEO
        if (mime.startsWith('video')) {
            ext = 'mp4';
        }

        // AUDIO
        else if (mime.startsWith('audio')) {
            ext = 'mp3';
        }

        else {
            return reply("❌ Reply to audio or video");
        }

        // LIMIT
        if (quoted.seconds && quoted.seconds > 600) {
            return reply("❌ Media too long");
        }

        // CONVERT
        const ptt = await converter.toPTT(buffer, ext);

        // MAIN FIX
        await client.sendMessage(targetJid, {
            audio: ptt,
            mimetype: 'audio/ogg; codecs=opus',
            ptt: true
        });

        await client.sendMessage(from, {
            react: {
                text: "✅",
                key: message.key
            }
        });

    } catch (e) {

        console.error('PTT Error:', e);

        reply(`❌ ${e.message}`);
    }

});
