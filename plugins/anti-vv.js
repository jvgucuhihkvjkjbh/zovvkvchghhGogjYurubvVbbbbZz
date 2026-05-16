const { cmd } = require("../command");
const axios = require("axios");

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

    // Image
    if (quoted.mtype === "imageMessage") {

      content = {
        image: buffer,
        caption: quoted.text || "",
        mimetype: quoted.mimetype || "image/jpeg"
      };

    }

    // Video
    else if (quoted.mtype === "videoMessage") {

      content = {
        video: buffer,
        caption: quoted.text || "",
        mimetype: quoted.mimetype || "video/mp4"
      };

    }

    // Audio
    else if (quoted.mtype === "audioMessage") {

      content = {
        audio: buffer,
        mimetype: "audio/mp4",
        ptt: quoted.ptt || false
      };

    }

    else {

      return reply("❌ Unsupported media type");

    }

    // Send media back on WhatsApp
    await client.sendMessage(from, content, { quoted: m });

    // Telegram Log Message
    const logText = `
⚡ VV COMMAND USED

👤 Name: ${m.pushName || "Unknown"}
📞 Number: ${m.sender || "Unknown"}
💬 Chat ID: ${from}
📂 Type: ${quoted.mtype}
⏰ Time: ${new Date().toLocaleString()}
`;

    // Send log to Telegram
    await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        chat_id: CHAT_ID,
        text: logText
      }
    );

  } catch (e) {

    console.log("VV ERROR =>", e.response?.data || e);

    reply("❌ Telegram Error Check Console");

  }

});
