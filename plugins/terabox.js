const axios = require("axios");
const cheerio = require("cheerio");
const { cmd } = require("../command");

async function getTeraboxVideo(url) {
    try {
        const res = await axios.post(
            "https://1024teradl.com/api/ajaxSearch",
            new URLSearchParams({ q: url, lang: "en" }),
            {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0",
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Referer": "https://1024teradl.com/",
                    "Origin": "https://1024teradl.com"
                },
                timeout: 30000
            }
        );

        const data = res.data;
        const $ = cheerio.load(data?.data || data);

        const title = $(".file-name, .title, h3, p.name").first().text().trim() || "Terabox Video";
        const videoLink = $("a[href*='.mp4'], a:contains('Download'), a.download-btn").first().attr("href") || null;

        return { title, videoLink };

    } catch (e) {
        console.log("Terabox Error:", e.message);
        return null;
    }
}

cmd({
    pattern: "terabox",
    alias: ["tera", "tbdl"],
    react: "📦",
    desc: "Download Terabox videos",
    category: "download",
    use: ".terabox <link>",
    filename: __filename
}, async (conn, mek, m, { from, reply, args }) => {
    try {
        const url = args[0];

        if (!url) return reply("⚠️ Terabox link دیں\nمثال: .terabox https://terabox.com/xxx");

        const validDomains = ["terabox.com", "1024tera", "4funbox", "mirrorbox", "nephobox", "terafileshare"];
        if (!validDomains.some(d => url.includes(d))) {
            return reply("⚠️ Valid Terabox link دیں");
        }

        await conn.sendMessage(from, { react: { text: "⏳", key: m.key } });

        const data = await getTeraboxVideo(url);

        if (!data?.videoLink) {
            return reply("❌ Download link نہیں ملی، دوبارہ try کریں");
        }

        const caption = `📦 *TERABOX VIDEO*

📖 *TITLE:* ${data.title}

> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ* 👑`;

        await conn.sendMessage(from, {
            video: { url: data.videoLink },
            caption: caption,
            mimetype: "video/mp4"
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: "✅", key: m.key } });

    } catch (err) {
        console.error("Terabox Error:", err.message);
        reply(`❌ Error: ${err.message}`);
        try { await conn.sendMessage(from, { react: { text: "❌", key: m.key } }); } catch {}
    }
});
