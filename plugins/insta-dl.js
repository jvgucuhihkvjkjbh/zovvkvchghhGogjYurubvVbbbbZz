const axios = require("axios");
const cheerio = require("cheerio");
const { cmd } = require('../command');

async function downloadInstagram(url) {
    try {
        const res = await axios.get(
            `https://vdfr.app/download/?url=${encodeURIComponent(url)}`,
            {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.9",
                    "Referer": "https://vdfr.app/"
                },
                timeout: 30000
            }
        );

        const $ = cheerio.load(res.data);
        const links = [];

        $("a[href*='vdfr'], a[href*='.mp4'], a[href*='cdninstagram'], a[href*='fbcdn'], a[href*='download']").each((i, el) => {
            const href = $(el).attr("href");
            const text = $(el).text().trim().toLowerCase();
            if (!href || text.includes("audio") || text.includes("mp3")) return;
            if (href.startsWith("http") && !links.find(l => l.url === href)) {
                const isImage = href.includes(".jpg") || href.includes(".jpeg") || href.includes(".webp");
                links.push({
                    url: href,
                    contentType: isImage ? "image/jpeg" : "video/mp4"
                });
            }
        });

        return links.length ? [links[0]] : null;

    } catch (e) {
        console.error("VDFR Error:", e.message);
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
        console.error("IGDL Error:", err.message);
        await conn.sendMessage(from, { react: { text: "❌", key: m.key } });
        reply("❌ Download failed: " + err.message);
    }
});
