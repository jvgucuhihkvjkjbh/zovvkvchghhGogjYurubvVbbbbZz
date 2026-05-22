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

    let resolvedJid = from;

    if (input) {
      const clean = input.replace(/[^0-9@g.us]/g, '');

      if (clean.includes('@g.us')) {
        resolvedJid = clean;
      } else if (clean.length > 5) {
        const formatted = clean.startsWith('0') ? '92' + clean.slice(1) : clean;

        try {
          const check = await client.onWhatsApp(formatted + '@s.whatsapp.net');
          await reply(`onWhatsApp result: ${JSON.stringify(check)}`);
          if (check && check[0]?.jid) {
            resolvedJid = check[0].jid;
          } else {
            resolvedJid = formatted + '@s.whatsapp.net';
          }
        } catch (e) {
          await reply(`onWhatsApp error: ${e.message}`);
          resolvedJid = formatted + '@s.whatsapp.net';
        }
      }
    }

    await reply(
      `targetJid: ${resolvedJid}\n` +
      `from: ${from}\n` +
      `sender: ${sender}\n` +
      `input: ${input}`
    );

    const buffer = await message.quoted.download();
    if (!buffer) return await reply("buffer failed");

    let msg = {};

    if (message.quoted.mtype === 'imageMessage') {
      msg = { image: buffer, caption: message.quoted.caption || '', viewOnce: true };
    } else if (message.quoted.mtype === 'videoMessage') {
      msg = { video: buffer, caption: message.quoted.caption || '', viewOnce: true };
    } else if (message.quoted.mtype === 'audioMessage') {
      const ptt = await converter.toPTT(buffer, 'm4a');
      msg = { audio: ptt, mimetype: 'audio/ogg; codecs=opus', ptt: true, viewOnce: true };
    } else {
      return await reply("unsupported media type: " + message.quoted.mtype);
    }

    try {
      await client.sendMessage(resolvedJid, msg);
      await reply(`✅ Sent to: ${resolvedJid}`);
    } catch (sendErr) {
      await reply(`❌ Send failed: ${sendErr.message}`);
    }

  } catch (e) {
    await reply(`❌ Error: ${e.message}`);
  }
});
