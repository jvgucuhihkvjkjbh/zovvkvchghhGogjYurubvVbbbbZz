const { cmd } = require('../command');
const axios = require('axios');

cmd({
  pattern: "terabox",
  alias: ["tera", "tbx", "terabox2"],
  desc: "Download Terabox video",
  category: "download",
  react: "📦",
  filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
  try {

    if (!q) return reply("❌ Please send a Terabox link");

    const url = q.trim();

    await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

    const { data } = await axios.get(
      `https://jerrycoder.oggyapi.workers.dev/down/terabx?url=${encodeURIComponent(url)}`,
      { timeout: 30000, headers: { "User-Agent": "Mozilla/5.0" } }
    );

    if (data.status !== "success" || !data.download) {
      return reply("❌ Failed to fetch video");
    }

    const fileName = data.filename || `terabox_${Date.now()}.mp4`;
    const sizeMB = data.size ? (data.size / (1024 * 1024)).toFixed(2) + " MB" : "Unknown";
    const thumbnail = data.thumbnails?.url2 || data.thumbnails?.url1 || null;
    const downloadUrl = data.download.fast || data.download.normal;

    const caption =
      `🎬 *${fileName}*\n\n` +
      `📦 *Size:* ${sizeMB}\n\n` +
      `> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡`;

    if (thumbnail) {
      try {
        await conn.sendMessage(from, {
          image: { url: thumbnail },
          caption
        }, { quoted: mek });
      } catch {}
    }

    await conn.sendMessage(from, {
      document: { url: downloadUrl },
      mimetype: "video/mp4",
      fileName,
      caption
    }, { quoted: mek });

    await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });

  } catch (e) {
    await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
    reply(`❌ ${e.message}`);
  }
});
