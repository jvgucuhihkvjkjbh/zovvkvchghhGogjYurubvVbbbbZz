const converter = require('../data/converter');
const { cmd } = require('../command');
const fs = require("fs");

cmd({
    pattern: 'onceall',
    alias: ['viewonce', 'sendvv'],
    desc: 'Send media as view-once',
    category: 'media',
    react: '👁️',
    filename: __filename
}, async (client, message, m, { from, isOwner, sender, q, reply }) => {

    try {

        const quoted = message.quoted;

        if (!quoted) {
            return reply("❌ Reply to media");
        }

        let targetJid = from;

        const input = (q || '').trim();

        // Owner / sudo check
        if (input) {

            let sudoList = [];

            if (fs.existsSync("./lib/sudo.json")) {
                sudoList = JSON.parse(fs.readFileSync("./lib/sudo.json"));
            }

            const normalize = (id) => id.replace(/[^0-9]/g, '');

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

                    const check = await client.onWhatsApp(jid);

                    if (!check || !check.length) {
                        return reply("❌ User not found on WhatsApp");
                    }

                    targetJid = check[0].jid;

                } catch {

                    targetJid = jid;
                }
            }
        }

        // DOWNLOAD MEDIA
        const buffer = await quoted.download();

        if (!buffer) {
            return reply("❌ Failed to download media");
        }

        const mime =
            quoted.mimetype ||
            quoted.msg?.mimetype ||
            '';

        let msg = {};

        // IMAGE
        if (mime.startsWith('image')) {

            msg = {
                image: buffer,
                caption: quoted.caption || '',
                viewOnce: true
            };
        }

        // VIDEO
        else if (mime.startsWith('video')) {

            msg = {
                video: buffer,
                caption: quoted.caption || '',
                viewOnce: true
            };
        }

        // AUDIO
        else if (mime.startsWith('audio')) {

            const ptt = await converter.toPTT(buffer, 'mp3');

            msg = {
                audio: ptt,
                mimetype: 'audio/ogg; codecs=opus',
                ptt: true,
                viewOnce: true
            };
        }

        else {
            return reply("❌ Unsupported media type");
        }

        // MAIN FIX
        await client.sendMessage(targetJid, msg);

        await client.sendMessage(from, {
            react: {
                text: "✅",
                key: message.key
            }
        });

    } catch (e) {

        console.log("VV Error:", e);

        reply(`❌ Error: ${e.message}`);
    }

});
