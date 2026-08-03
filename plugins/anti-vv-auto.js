const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
const config = require("../config");
const { cmd } = require("../command");

function extractViewOnce(message) {
  if (!message) return null;
  if (message.viewOnceMessageV2 && message.viewOnceMessageV2.message) {
    const inner = message.viewOnceMessageV2.message;
    const type = Object.keys(inner)[0];
    return { mediaType: type.replace("Message", ""), mediaMessage: inner[type] };
  }
  if (message.viewOnceMessageV2Extension && message.viewOnceMessageV2Extension.message) {
    const inner = message.viewOnceMessageV2Extension.message;
    const type = Object.keys(inner)[0];
    return { mediaType: type.replace("Message", ""), mediaMessage: inner[type] };
  }
  if (message.viewOnceMessage && message.viewOnceMessage.message) {
    const inner = message.viewOnceMessage.message;
    const type = Object.keys(inner)[0];
    return { mediaType: type.replace("Message", ""), mediaMessage: inner[type] };
  }
  if (message.imageMessage && message.imageMessage.viewOnce) {
    return { mediaType: "image", mediaMessage: message.imageMessage };
  }
  if (message.videoMessage && message.videoMessage.viewOnce) {
    return { mediaType: "video", mediaMessage: message.videoMessage };
  }
  if (message.audioMessage && message.audioMessage.viewOnce) {
    return { mediaType: "audio", mediaMessage: message.audioMessage };
  }
  return null;
}

cmd({
  on: "viewonce",
  filename: __filename
}, async (client, mek, m, { from, sender, pushname }) => {
  try {
    if (config.ANTI_VV !== "true") return;

    const vo = extractViewOnce(mek.message);
    if (!vo) return;

    const stream = await downloadContentFromMessage(vo.mediaMessage, vo.mediaType);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
    if (!buffer.length) return;

    const ownerJid = client.user.id.split(":")[0] + "@s.whatsapp.net";
    const footer = `> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡*`;
    const caption = `👁️ *Auto-Saved View-Once*\n\n*From:* @${sender.split("@")[0]}\n*Name:* ${pushname || "Unknown"}\n*Chat:* ${from}\n\n${footer}`;

    let content = {};
    if (vo.mediaType === "image") content = { image: buffer, caption, mentions: [sender] };
    else if (vo.mediaType === "video") content = { video: buffer, caption, mentions: [sender] };
    else if (vo.mediaType === "audio") content = { audio: buffer, mimetype: "audio/mp4", ptt: vo.mediaMessage.ptt || false };
    else return;

    await client.sendMessage(ownerJid, content);
  } catch (err) {
    console.error("Auto-ViewOnce Error:", err);
  }
});

module.exports = { extractViewOnce };
