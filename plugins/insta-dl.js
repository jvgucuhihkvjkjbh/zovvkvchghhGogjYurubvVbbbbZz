const axios = require("axios");
const cheerio = require("cheerio");
const { cmd } = require('../command');

async function downloadInstagram(url) {
    try {
        const pageRes = await axios.get("https://snapinsta.app/", {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0",
            },
            timeout: 15000
        });

        const $ = cheerio.load(pageRes.data);
        const token = $('input[name="_token"]').val();
        if (!token) return null;

        const res = await axios.post(
            "https://snapinsta.app/action.php",
            new URLSearchParams({ url, token }),
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Referer": "https://snapinsta.app/",
                    "Origin": "https://snapinsta.app",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0"
                },
                timeout: 20000
            }
        );

        const $r = cheerio.load(res.data);
        const links = [];

        $r("a.download-btn, a[href*='.mp4'], a[href*='cdninstagram'], a[href*='fbcdn']").each((i, el) => {
            const href = $r(el).attr("href");
            const text = $r(el).text().trim().toLowerCase();
            if (!href || text.includes("audio") || text.includes("mp3")) return;
            if (!links.find(l => l.url === href)) {
                links.push({ url: href, contentType: "video/mp4" });
            }
        });

        $r("a[href*='.jpg'], a[href*='.jpeg'], a[href*='.webp']").each((i, el) => {
            const href = $r(el).attr("href");
            if (href && !links.find(l => l.url === href)) {
                links.push({ url: href, contentType: "image/jpeg" });
            }
        });

        return links.length ? links : null;

    } catch (e) {
        return null;
    }
}

cmd({
    pattern: "igdl",
    alias: ["instagram", "insta", "ig"],
    react: "⬇️",
    desc: "Download Instagram videos/reels",
    category: "downloader",
    use: ".igdl <Instagram URL>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q }) => {
    try {
        const url = q || m.quoted?.text;
        if (!url || !url.includes("instagram.com")) {
            return reply("❌ Please provide/reply to a valid Instagram link");
        }

        await conn.sendMessage(from, { react: { text: "⏳", key: m.key } });

        const results = await downloadInstagram(url);

        if (!results || !results.length) {
            await conn.sendMessage(from, { react: { text: "❌", key: m.key } });
            return reply("❌ Invalid or private link.");
        }

        const caption = `*INSTAGRAM REEL*

> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ*`;

        for (const item of results) {
            if (!item.url) continue;
            const isVideo = item.contentType?.includes("video");
            await conn.sendMessage(from, {
                [isVideo ? "video" : "image"]: { url: item.url },
                caption
            }, { quoted: mek });
        }

        await conn.sendMessage(from, { react: { text: "✅", key: m.key } });

    } catch (err) {
        console.error("IGDL Error:", err);
        await conn.sendMessage(from, { react: { text: "❌", key: m.key } });
        reply("❌ Download failed.");
    }
});
