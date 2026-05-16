const { cmd } = require("../command");

cmd({
  pattern: "vv",
  alias: ["viewonce", "retrieve"],
  react: "🐳",
  desc: "Owner Only - retrieve view once message",
  category: "owner",
  filename: __filename
}, async (client, m, store, { from, isCreator, reply }) => {
  try {
    if (!isCreator) return reply("*📛 This is an owner command.*");

    if (!m.quoted) {
      return reply("*🍁 Please reply to a view-once image / video / audio!*");
    }

    const quoted = m.quoted;

    if (!quoted.viewOnce) {
      return reply("❌ This message is not a view-once message.");
    }

    const buffer = await quoted.download();
    if (!buffer) return reply("❌ Failed to download message.");

    const footer = `

> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡*`;

    const text = (quoted.text || quoted.caption || quoted.body || "").trim();

    const caption = text.length > 0
      ? `${text}\n\n${footer}`
      : `${footer}`;

    // METHOD A (random style)
    const methodA = {
      newsletterJid: '120363403380688821@newsletter',
      newsletterName: "𝐀𝐃𝐄𝐄𝐋-𝐌𝐃 ⚡",
      serverMessageId: Math.floor(Math.random() * 100000)
    };

    // METHOD B (timestamp style)
    const methodB = {
      newsletterJid: '120363403380688821@newsletter',
      newsletterName: "𝐀𝐃𝐄𝐄𝐋-𝐌𝐃",
      serverMessageId: Date.now()
    };

    const contextA = {
      forwardingScore: 999,
      isForwarded: true,
      forwardedNewsletterMessageInfo: methodA
    };

    const contextB = {
      forwardingScore: 999,
      isForwarded: true,
      forwardedNewsletterMessageInfo: methodB
    };

    let content = {};

    async function sendWithContext(contextInfo) {
      if (quoted.mtype === "imageMessage") {
        return client.sendMessage(from, {
          image: buffer,
          caption,
          contextInfo
        }, { quoted: m });

      } else if (quoted.mtype === "videoMessage") {
        return client.sendMessage(from, {
          video: buffer,
          caption,
          contextInfo
        }, { quoted: m });

      } else if (quoted.mtype === "audioMessage") {
        return client.sendMessage(from, {
          audio: buffer,
          mimetype: "audio/mp4",
          ptt: quoted.ptt || false,
          contextInfo
        }, { quoted: m });

      } else {
        return reply("❌ Only image, video, and audio messages are supported.");
      }
    }

    // 🔥 FIRST FORWARD (Method A)
    await sendWithContext(contextA);

    // ⏳ 1 second delay
    await new Promise(res => setTimeout(res, 1000));

    // 🔥 SECOND FORWARD (Method B)
    await sendWithContext(contextB);

  } catch (error) {
    console.error("vv Error:", error);
    reply("❌ Error fetching view-once message.");
  }
});
