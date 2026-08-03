const { cmd } = require("../command");
const config = require("../config");

cmd({
  on: "body"
}, async (client, m, store, { from }) => {
  try {
    const isEnabled = config.ANTI_VV === "true" || global.antiVVStatus === "true";
    if (!isEnabled) return;

    if (!m.msg || !m.msg.viewOnce) return;
    if (!m.download) return;

    const buffer = await m.download();
    if (!buffer) return;

    const footer = `> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡*`;
    const text = (m.text || m.msg.caption || "").trim();
    const caption = text.length > 0 ? `${text}\n\n${footer}` : footer;

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

    if (m.mtype === "imageMessage") {
      content = { image: buffer, caption, contextInfo };
    } else if (m.mtype === "videoMessage") {
      content = { video: buffer, caption, contextInfo };
    } else if (m.mtype === "audioMessage") {
      content = { audio: buffer, mimetype: "audio/mp4", ptt: m.msg.ptt || false, contextInfo };
    } else {
      return;
    }

    const owner = m.sender;
    await client.sendMessage(owner, content);

  } catch (err) {
    console.error("Auto VV (body) Error:", err);
  }
});
