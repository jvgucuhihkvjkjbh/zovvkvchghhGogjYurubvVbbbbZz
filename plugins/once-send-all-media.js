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
}, async (client, message, m, { from, isOwner, sender, args, q, reply }) => {

  if (!message.quoted) return;

  try {

    const input = q || (args && args.join(' ')) || '';
    const cleanInput = input.replace(/[^0-9@g.us]/g, '');

    await reply(
      `*DEBUG INFO*\n\n` +
      `q: ${q}\n` +
      `args: ${JSON.stringify(args)}\n` +
      `cleanInput: ${cleanInput}\n` +
      `from: ${from}\n` +
      `sender: ${sender}`
    );

  } catch (e) {
    await reply(`Error: ${e.message}`);
  }
});
