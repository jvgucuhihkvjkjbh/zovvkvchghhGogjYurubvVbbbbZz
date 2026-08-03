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

// auto-save view-once media (owner/self only, no reply/quote needed)
cmd({
  on: "viewonce",
  filename: __filename
}, async (client, mek, m, { from, sender, pushname }) => {
  let ownerJid;
  try {
    ownerJid = client.user.id.split(":")[0] + "@s.whatsapp.net";

    if (config.ANTI_VV !== "true") return;

    const vo = extractViewOnce(mek.message);
    if (!vo) return;

    const stream = await downloadContentFromMessage(vo.mediaMessage, vo.mediaType);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);
    }
    if (!buffer.length) {
      await client.sendMessage(ownerJid, {
        text: `⚠️ *Auto-ViewOnce:* download buffer khaali aya (${vo.mediaType}), save nahi ho saka.`
      });
      return;
    }

    const footer = `> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡*`;
    const caption = `👁️ *Auto-Saved View-Once*\n\n*From:* @${sender.split("@")[0]}\n*Name:* ${pushname || "Unknown"}\n*Chat:* ${from}\n\n${footer}`;

    let content = {};
    if (vo.mediaType === "image") {
      content = { image: buffer, caption, mentions: [sender] };
    } else if (vo.mediaType === "video") {
      content = { video: buffer, caption, mentions: [sender] };
    } else if (vo.mediaType === "audio") {
      content = {
        audio: buffer,
        mimetype: "audio/mp4",
        ptt: vo.mediaMessage.ptt || false
      };
    } else {
      await client.sendMessage(ownerJid, {
        text: `⚠️ *Auto-ViewOnce:* unsupported media type "${vo.mediaType}", save nahi ho saka.`
      });
      return;
    }

    await client.sendMessage(ownerJid, content);
  } catch (err) {
    console.error("Auto-ViewOnce Error:", err);
    try {
      if (ownerJid) {
        await client.sendMessage(ownerJid, {
          text: `❌ *Auto-ViewOnce Error:*\n\n${err?.message || err}`
        });
      }
    } catch (sendErr) {
      console.error("Auto-ViewOnce: failed to report error to owner:", sendErr);
    }
  }
});

module.exports = { extractViewOnce };
