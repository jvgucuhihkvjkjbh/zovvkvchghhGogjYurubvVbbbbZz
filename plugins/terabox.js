const { cmd } = require('../command');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

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

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes)) return "Unknown";

  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));

  return (
    parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) +
    ' ' +
    sizes[i]
  );
}

const tempFile = (ext) =>
  path.join(
    os.tmpdir(),
    `${crypto.randomBytes(6).toString('hex')}.${ext}`
  );

cmd({
  pattern: "terabox",
  alias: ["tera", "tbx", "terabox2"],
  desc: "Download Terabox video",
  category: "download",
  react: "📦",
  filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {

  let outputPath;

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

    let fileName = "Unknown.mp4";
    let size = "Unknown";
    let thumbnail = null;
    let downloadUrl = null;
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

        if (
          data?.status === "success" &&
          data?.download
        ) {

          fileName =
            data.filename ||
            `terabox_${Date.now()}.mp4`;

          size = formatBytes(Number(data.size));

          thumbnail =
            data?.thumbnails?.url2 ||
            data?.thumbnails?.url1 ||
            data?.thumbnails?.url3 ||
            null;

          downloadUrl =
            data?.download?.fast ||
            data?.download?.normal;

          success = true;
        }

      } catch (e) {
        console.log("API 1 Error:", e.message);
      }
    }

    // API 2
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

        if (
          data?.status === "success" &&
          (data?.download || data?.stream)
        ) {

          fileName =
            data.title ||
            data.raw?.result?.file_name ||
            `terabox_${Date.now()}.mp4`;

          size = formatBytes(Number(data.size));

          thumbnail =
            data.thumbnail ||
            data.raw?.result?.thumb_url ||
            null;

          downloadUrl =
            data.download ||
            data.stream ||
            data.raw?.result?.data?.[0]?.stream_url;

          success = true;
        }

      } catch (e) {
        console.log("API 2 Error:", e.message);
      }
    }

    if (!success || !downloadUrl) {

      await conn.sendMessage(from, {
        react: { text: "❌", key: mek.key }
      });

      return reply(
        "❌ All download servers are currently unavailable."
      );
    }

    const caption =
      `🎬 *${fileName}*\n\n` +
      `📦 *Size:* ${size}\n\n` +
      `> ⚡ *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ* ⚡`;

    if (thumbnail) {
      try {

        await conn.sendMessage(from, {
          image: { url: thumbnail },
          caption
        }, { quoted: mek });

      } catch (e) {
        console.log("Thumbnail Error:", e.message);
      }
    }

    // FIXED DOWNLOAD SYSTEM
    outputPath = tempFile('mp4');

    const response = await axios({
      url: downloadUrl,
      method: 'GET',
      responseType: 'stream',
      timeout: 0,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://terabox.com/"
      }
    });

    const writer = fs.createWriteStream(outputPath);

    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    // CHECK FILE
    if (!fs.existsSync(outputPath)) {
      return reply("❌ Video download failed");
    }

    const stats = fs.statSync(outputPath);

    // 100KB se kam ho to invalid
    if (stats.size < 100000) {

      fs.unlinkSync(outputPath);

      return reply("❌ Invalid video response");
    }

    await conn.sendMessage(from, {
      document: fs.readFileSync(outputPath),
      mimetype: 'video/mp4',
      fileName,
      caption
    }, { quoted: mek });

    await conn.sendMessage(from, {
      react: { text: "✅", key: mek.key }
    });

  } catch (e) {

    console.log("Terabox Error:", e);

    await conn.sendMessage(from, {
      react: { text: "❌", key: mek.key }
    });

    reply(`❌ ${e.message}`);

  } finally {

    if (outputPath && fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }
  }
});
