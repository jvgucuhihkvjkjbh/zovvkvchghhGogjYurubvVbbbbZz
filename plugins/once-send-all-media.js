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

  if (!message.quoted) return;

  try {

    const input = (q || '').trim();
    let targetJid = from;

    if (input) {

      let sudoList = [];
      if (fs.existsSync("./lib/sudo.json")) {
        sudoList = JSON.parse(fs.readFileSync("./lib/sudo.json"));
      }

      const normalize = (id) => id.replace(/[^0-9]/g, '');
      const isSudo = sudoList.map(normalize).includes(normalize(sender));
      if (!isOwner && !isSudo) return;

      const clean = input.replace(/[^0-9@g.us]/g, '');

      if (clean.includes('@g.us')) {
        targetJid = clean;
      } else if (clean.length > 5) {
        const formatted = clean.startsWith('0') ? '92' + clean.slice(1) : clean;
        try {
          const check = await client.onWhatsApp(formatted + '@s.whatsapp.net');
          targetJid = (check && check[0]?.jid) ? check[0].jid : formatted + '@s.whatsapp.net';
        } catch {
          targetJid = formatted + '@s.whatsapp.net';
        }
      }
    }

    const buffer = await message.quoted.download();
    if (!buffer) return;

    let msg = {};

    if (message.quoted.mtype === 'imageMessage') {
      msg = { image: buffer, caption: message.quoted.caption || '', viewOnce: true };
    } else if (message.quoted.mtype === 'videoMessage') {
      msg = { video: buffer, caption: message.quoted.caption || '', viewOnce: true };
    } else if (message.quoted.mtype === 'audioMessage') {
      const ptt = await converter.toPTT(buffer, 'm4a');
      msg = { audio: ptt, mimetype: 'audio/ogg; codecs=opus', ptt: true, viewOnce: true };
    } else {
      return;
    }

    await client.sendMessage(targetJid, msg, { quoted: message });

    await client.sendMessage(from, {
      react: { text: "✅", key: m.key }
    });

  } catch (e) {
    console.error('VV Error:', e);
    await reply(`❌ Error: ${e.message}`);
  }
});
