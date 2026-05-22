const converter = require('../data/converter');
const { cmd } = require('../command');
const fs = require("fs");

const normalizeId = (id) => {
  if (!id) return '';
  return id
    .replace(/:[0-9]+/g, '')
    .replace(/@(lid|s\.whatsapp\.net|c\.us|g\.us)/g, '')
    .replace(/[^\d]/g, '');
};

async function resolveJid(conn, input) {
  const clean = input.replace(/[^0-9@g.us]/g, '');

  if (clean.includes('@g.us')) return clean;

  if (clean.length > 5) {
    const formatted = clean.startsWith('0')
      ? '92' + clean.slice(1)
      : clean;

    try {
      const result = await conn.onWhatsApp(formatted + '@s.whatsapp.net');
      if (result && result[0]) return result[0].jid;
    } catch {}

    return formatted + '@s.whatsapp.net';
  }

  return null;
}

cmd({
  pattern: 'onceall',
  alias: ['viewonce', 'sendvv'],
  desc: 'Send media as view-once (image/video/audio)',
  category: 'media',
  react: '👁️',
  filename: __filename
}, async (client, message, m, { from, isOwner, sender, q }) => {

  if (!message.quoted) return;

  try {

    const input = (q || '').trim();

    let targetJid = from;

    if (input) {

      let sudoList = [];
      if (fs.existsSync("./lib/sudo.json")) {
        sudoList = JSON.parse(fs.readFileSync("./lib/sudo.json"));
      }

      const isSudo = sudoList
        .map(normalizeId)
        .includes(normalizeId(sender));

      if (!isOwner && !isSudo) return;

      const resolved = await resolveJid(client, input);
      if (resolved) targetJid = resolved;
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

    await client.sendMessage(targetJid, msg);

    await client.sendMessage(from, {
      react: { text: "✅", key: m.key }
    });

  } catch (e) {
    console.error('VV Error:', e);
  }
});
