const axios = require("axios");
const cheerio = require("cheerio");
const { cmd } = require('../command');

async function getInstagramVideo(url) {
    try {
        const res = await axios.get(
            `https://vdfr.app/download/?url=${encodeURIComponent(url)}`,
            {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0",
                    "Referer": "https://vdfr.app/",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
                },
                timeout: 30000
            }
        );

        const $ = cheerio.load(res.data);
        const links = [];

        // ━━━ سب links اٹھاؤ ━━━
        $("a[href*='.mp4'], a[href*='cdninstagram'], a[href*='fbcdn'], a.download-btn").each((i, el) => {
            const href = $(el).attr("href");
            const text = $(el).text().trim().toLowerCase();

            // audio only skip کرو
            if (text.includes("audio") || text.includes("mp3")) return;

            if (href && !links.find(l => l.url === href)) {
                // resolution اٹھاؤ
                const resMatch = text.match(/(\d+)x(\d+)/);
                const width = resMatch ? parseInt(resMatch[1]) : 9999;
                const height = resMatch ? parseInt(resMatch[2]) : 9999;

                links.push({
                    url: href,
                    contentType: "video/mp4",
                    width,
                    height
                });
            }
        });

        // ━━━ image links ━━━
        $("a[href*='.jpg'], a[href*='.jpeg'], a[href*='.webp']").each((i, el) => {
            const href = $(el).attr("href");
            if (href && !links.find(l => l.url === href)) {
                links.push({ url: href, contentType: "image/jpeg" });
            }
        });

        if (!links.length) return null;

        // ━━━ سب سے کم resolution video پہلے ━━━
        const videos = links
            .filter(l => l.contentType === "video/mp4")
            .sort((a, b) => (a.width * a.height) - (b.width * b.height));

        const images = links.filter(l => l.contentType !== "video/mp4");

        // ━━━ صرف سب سے کم MB والی video ━━━
        const result = [];
        if (videos.length) result.push(videos[0]);
        result.push(...images);

        return result.length ? result : null;

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

        const results = await getInstagramVideo(url);

        if (!results || !results.length) {
            await conn.sendMessage(from, { react: { text: "❌", key: m.key } });
            return reply("❌ Invalid or private link.");
        }

        const captionText = `*INSTAGRAM REEL*

> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ*`;

        for (const item of results) {
            if (!item.url) continue;
            const isVideo = item.contentType?.includes("video");
            await conn.sendMessage(from, {
                [isVideo ? "video" : "image"]: { url: item.url },
                caption: captionText
            }, { quoted: mek });
        }

        await conn.sendMessage(from, { react: { text: "✅", key: m.key } });

    } catch (err) {
        console.error("IGDL Error:", err);
        await conn.sendMessage(from, { react: { text: "❌", key: m.key } });
        reply("❌ Download failed.");
    }
});
