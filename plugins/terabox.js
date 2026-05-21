const { cmd } = require('../command');
const axios = require('axios');

const TERABOX_DOMAINS = [
  'terabox.com',
  '1024terabox.com',
  'terasharefile.com',
  'terasharelink.com',
  '1024tera.com',
  'nephobox.com',
  '4funbox.com',
  'mirrobox.com',
  'momerybox.com',
  'teraboxapp.com',
  'gibibox.com',
  'mdisk.me'
];

function isTeraboxLink(url) {
  return TERABOX_DOMAINS.some(domain => url.includes(domain));
}

function normalizeTeraboxUrl(url) {
  try {
    const urlObj = new URL(url);
    const shard = urlObj.pathname + urlObj.search;
    return `https://1024terabox.com${shard}`;
  } catch {
    return url;
  }
}

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

    if (!q) {
      return reply("❌ Please send a Terabox link");
    }

    const url = q.trim();

    if (!isTeraboxLink(url)) {
      return reply("❌ Invalid Terabox link");
    }

    const normalizedUrl = normalizeTeraboxUrl(url);

    await conn.sendMessage(from, {
      react: { text: "⏳", key: mek.key }
    });

    let fileName;
    let sizeMB;
    let thumbnail;
    let downloadUrl;
    let success = false;

    // API 1
    if (!success) {
      try {

        const { data } = await axios.get(
          `https://jerrycoder.oggyapi.workers.dev/down/terabx?url=${encodeURIComponent(normalizedUrl)}`,
          {
            timeout: 60000,
            headers: {
              "User-Agent": "Mozilla/5.0"
            }
          }
        );

        if (data.status === "success" && data.download) {

          fileName =
            data.filename ||
            `terabox_${Date.now()}.mp4`;

          sizeMB =
            data.size
              ? (data.size / (1024 * 1024)).toFixed(2) + " MB"
              : "Unknown";

          thumbnail =
            data.thumbnails?.url2 ||
            data.thumbnails?.url1 ||
            data.thumbnails?.icon ||
            null;

          // FIXED
          downloadUrl =
            data.download.normal ||
            data.download.fast;

          success = true;
        }

      } catch (e) {
        console.log("Terabox API 1 Error:", e.message);
      }
    }

    // API 2 Backup
    if (!success) {
      try {

        const { data } = await axios.get(
          `https://jerrycoder.oggyapi.workers.dev/down/terabx-v1?url=${encodeURIComponent(normalizedUrl)}`,
          {
            timeout: 60000,
            headers: {
              "User-Agent": "Mozilla/5.0"
            }
          }
        );

        if (data.status === "success") {

          fileName =
            data.title ||
            `terabox_${Date.now()}.mp4`;

          sizeMB =
            data.size
              ? (parseInt(data.size) / (1024 * 1024)).toFixed(2) + " MB"
              : "Unknown";

          thumbnail = data.thumbnail || null;

          downloadUrl =
            data.download ||
            data.stream;

          success = true;
        }

      } catch (e) {
        console.log("Terabox API 2 Error:", e.message);
      }
    }

    if (!success || !downloadUrl) {

      await conn.sendMessage(from, {
        react: { text: "❌", key: mek.key }
      });

      return reply("❌ All download servers are unavailable");
    }

    const caption =
      `🎬 *${fileName}*\n\n` +
      `📦 *Size:* ${sizeMB}\n\n` +
      `> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ 🍸*`;

    // Thumbnail
    if (thumbnail) {
      try {

        await conn.sendMessage(
          from,
          {
            image: { url: thumbnail },
            caption
          },
          { quoted: mek }
        );

      } catch {}
    }

    // Download Video
    const videoRes = await axios.get(downloadUrl, {
      responseType: "arraybuffer",
      timeout: 300000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://1024terabox.com/"
      }
    });

    // FIX HTML ERROR
    const contentType = videoRes.headers['content-type'] || "";

    if (
      contentType.includes("text/html") ||
      contentType.includes("application/json")
    ) {
      throw new Error("Invalid video response");
    }

    const buffer = Buffer.from(videoRes.data);

    // FIX SMALL FILE ERROR
    if (buffer.length < 50000) {
      throw new Error("Corrupted video file");
    }

    await conn.sendMessage(
      from,
      {
        document: buffer,
        mimetype: "video/mp4",
        fileName,
        caption
      },
      { quoted: mek }
    );

    await conn.sendMessage(from, {
      react: { text: "✅", key: mek.key }
    });

  } catch (e) {

    console.log("Terabox Command Error:", e);

    await conn.sendMessage(from, {
      react: { text: "❌", key: mek.key }
    });

    reply(`❌ ${e.message}`);
  }
});
