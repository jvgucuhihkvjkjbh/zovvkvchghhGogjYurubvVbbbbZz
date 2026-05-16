const { cmd } = require("../command");

cmd({
  pattern: "vv2",
  alias: ["wah", "💋", "❤️", "✌", "nice", "ok"],
  desc: "Owner Only - retrieve view once message",
  category: "owner",
  filename: __filename
}, async (client, m, store, { from, isCreator, reply }) => {
  try {
    if (!isCreator) return;

    if (!m.quoted) {
      return reply("🍁 Please reply to a view-once image / video / audio");
    }

    const quoted = m.quoted;

    if (!quoted.viewOnce) {
      return reply("❌ This message is not a view-once message");
    }

    const buffer = await quoted.download();
    if (!buffer) return reply("❌ Failed to download message");

    const footer = `

> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡*`;

    const contextInfo = {
      forwardingScore: 999,
      isForwarded: true,
      forwardedNewsletterMessageInfo: {
        newsletterJid: '120363403380688821@newsletter',
        newsletterName: "𝐀𝐃𝐄𝐄𝐋-𝐌𝐃",
        serverMessageId: 143
      }
    };

    let content = {};

    if (quoted.mtype === "imageMessage") {
      content = {
        image: buffer,
        caption: (quoted.text || "") + footer,
        contextInfo
      };
    } 
    else if (quoted.mtype === "videoMessage") {
      content = {
        video: buffer,
        caption: (quoted.text || "") + footer,
        contextInfo
      };
    } 
    else if (quoted.mtype === "audioMessage") {
      content = {
        audio: buffer,
        mimetype: "audio/mp4",
        ptt: quoted.ptt || false,
        contextInfo
      };
    } 
    else {
      return reply("❌ Only image, video, and audio are supported");
    }

    const target = m.sender || from;

    await client.sendMessage(target, content, { quoted: m });

  } catch (err) {
    console.error("VV2 Error:", err);
    reply("❌ Failed to retrieve view-once message");
  }
});
