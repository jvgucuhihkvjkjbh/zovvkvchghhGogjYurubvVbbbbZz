const { cmd } = require("../command");
const config = require("../config");

cmd({
  on: "viewonce"
}, async (client, m, store, { from }) => {
  try {
    const isEnabled = config.ANTI_VV === "true" || global.antiVVStatus === "true";
    if (!isEnabled) return;

    // Case 1: modern format — viewOnce flag directly on the media message
    let target = null;
    if (m.msg && m.msg.viewOnce) {
      target = m;
    }

    // Case 2: older wrapped format — viewOnceMessage / viewOnceMessageV2
    let wrapped = null;
    if (!target && m.message) {
      wrapped = m.message.viewOnceMessageV2 || m.message.viewOnceMessage;
    }

    let buffer, mtype, ptt, caption;
    const footer = `> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡*`;

    if (target) {
      // direct-flag case — reuse the normal download path
      if (!m.download) return;
      buffer = await m.download();
      mtype = m.mtype;
      ptt = m.msg.ptt || false;
      const text = (m.text || m.msg.caption || "").trim();
      caption = text.length > 0 ? `${text}\n\n${footer}` : footer;
    } else if (wrapped && wrapped.message) {
      // wrapped case — unwrap manually
      const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
      const innerType = Object.keys(wrapped.message)[0];
      const innerMsg = wrapped.message[innerType];
      if (!innerMsg) return;

      const mediaMap = { imageMessage: "image", videoMessage: "video", audioMessage: "audio" };
      const mediaKind = mediaMap[innerType];
      if (!mediaKind) return;

      const stream = await downloadContentFromMessage(innerMsg, mediaKind);
      buffer = Buffer.from([]);
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

      mtype = innerType;
      ptt = innerMsg.ptt || false;
      caption = innerMsg.caption ? `${innerMsg.caption}\n\n${footer}` : footer;
    } else {
      return;
    }

    if (!buffer) return;

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
    if (mtype === "imageMessage") {
      content = { image: buffer, caption, contextInfo };
    } else if (mtype === "videoMessage") {
      content = { video: buffer, caption, contextInfo };
    } else if (mtype === "audioMessage") {
      content = { audio: buffer, mimetype: "audio/mp4", ptt, contextInfo };
    } else {
      return;
    }

    const owner = m.sender;
    await client.sendMessage(owner, content);

  } catch (err) {
    console.error("Auto VV Error:", err);
  }
});
