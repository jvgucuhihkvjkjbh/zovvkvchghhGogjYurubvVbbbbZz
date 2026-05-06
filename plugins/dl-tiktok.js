const axios = require("axios");
const cheerio = require("cheerio");
const { cmd } = require("../command");

async function getTikTokHDVideo(url) {
  const res = await axios.post(
    "https://savetik.co/api/ajaxSearch",
    new URLSearchParams({ q: url, lang: "en" }),
    {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0",
        "Content-Type": "application/x-www-form-urlencoded",
        "Referer": "https://savetik.co/en",
        "Origin": "https://savetik.co"
      },
      timeout: 20000
    }
  );

  const $ = cheerio.load(res.data?.data || res.data);

  const title = $("p.tik-name, p.maintext, h3, .video-title").first().text().trim() || "TikTok Video";
  const hdLink = $("a:contains('Download MP4 HD'), a:contains('MP4 HD'), a[href*='-hd']").first().attr("href") || null;
  const sdLink = $("a:contains('Download MP4 [1]'), a:contains('MP4')").first().attr("href") || null;

  return { title, videoLink: hdLink || sdLink };
}

cmd({
  pattern: "tiktok",
  alias: ["tt", "tiktokdl", "ttdl"],
  react: "🎵",
  desc: "Download TikTok videos in HD without watermark",
  category: "download",
  use: ".tiktok <TikTok link>",
  filename: __filename
}, async (conn, mek, m, { from, reply, args }) => {
  try {
    const url = args[0];

    if (!url) {
      return reply("⚠️ Please provide a TikTok link.\nExample: .tiktok https://vm.tiktok.com/xxx");
    }

    const validDomains = ["tiktok.com", "vm.tiktok.com", "vt.tiktok.com", "m.tiktok.com", "douyin.com"];
    if (!validDomains.some(d => url.includes(d))) {
      return reply("⚠️ Please provide a valid TikTok link.");
    }

    await conn.sendMessage(from, { react: { text: "⏳", key: m.key } });

    const data = await getTikTokHDVideo(url);

    if (!data?.videoLink) {
      return reply("❌ Could not get download link. Please try again.");
    }

    const caption = `🎵 *TIKTOK VIDEO* 🎵

📖 *TITLE:* ${data.title}

> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ* 👑`;

    await conn.sendMessage(from, {
      video: { url: data.videoLink },
      caption: caption,
      mimetype: "video/mp4"
    }, { quoted: mek });

    await conn.sendMessage(from, { react: { text: "✅", key: m.key } });

  } catch (error) {
    console.error("TikTok error:", error.message);
    reply(`❌ Error: ${error.message}`);
    try { await conn.sendMessage(from, { react: { text: "❌", key: m.key } }); } catch {}
  }
});