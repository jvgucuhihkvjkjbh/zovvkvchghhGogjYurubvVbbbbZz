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
}, async (client, message, m, { from, isOwner, sender }) => {

  if (!message.quoted) return;

  try {

    const text = m.text || m.body || '';
    const input = text.replace(/^[.\-!#]?\w+\s*/, '').trim();
    const cleanInput = input.replace(/[^0-9@g.us]/g, '');

    let targetJid = from;

    if (cleanInput) {

      let sudoList = [];
      if (fs.existsSync("./lib/sudo.json")) {
        sudoList = JSON.parse(fs.readFileSync("./lib/sudo.json"));
      }

      const normalize = (id) => id.replace(/[^0-9]/g, '');
      const isSudo = sudoList.map(normalize).includes(normalize(sender));

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

    const buffer = await message.quoted.download();
    if (!buffer) return;

    let msg = {};

    if (message.quoted.mtype === 'imageMessage') {
      msg = {
        image: buffer,
        caption: message.quoted.caption || '',
        viewOnce: true
      };
    } else if (message.quoted.mtype === 'videoMessage') {
      msg = {
        video: buffer,
        caption: message.quoted.caption || '',
        viewOnce: true
      };
    } else if (message.quoted.mtype === 'audioMessage') {
      const ptt = await converter.toPTT(buffer, 'm4a');
      msg = {
        audio: ptt,
        mimetype: 'audio/ogg; codecs=opus',
        ptt: true,
        viewOnce: true
      };
    } else {
      return;
    }

    await client.sendMessage(targetJid, msg);

    await client.sendMessage(from, {
      react: { text: "✅", key: m.key }
    });

  } catch (e) {
    console.error('VV Error:', e);
  }
});
