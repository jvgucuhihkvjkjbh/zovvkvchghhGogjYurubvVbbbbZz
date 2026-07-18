const axios = require("axios");
const cheerio = require("cheerio");
const { cmd } = require("../command");

async function getPinloadLinks(url) {
    const res = await axios.get(
        `https://pinload.net/download/?url=${encodeURIComponent(url)}`,
        {
            headers: {
                "User-Agent": "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36",
                "Accept": "text/html,application/xhtml+xml",
                "Referer": "https://pinload.net/",
                "Accept-Language": "en-US,en;q=0.9",
            },
            timeout: 20000,
            maxRedirects: 5
        }
    );

    const $ = cheerio.load(res.data);
    const links = [];

    $("table tr").each((i, el) => {
        const href = $(el).find("a[href]").first().attr("href");
        if (href && href.startsWith("http")) links.push(href);
    });

    if (!links.length) {
        $("a[href]").each((i, el) => {
            const href = $(el).attr("href");
            if (href && href.startsWith("http") && !href.includes("pinload.net") && !href.includes("google") && !href.includes("facebook")) {
                links.push(href);
            }
        });
    }

    return links;
}

// ===== PHOTO COMMAND =====
cmd({
    pattern: "pindl",
    alias: ["pin", "pinterestdl", "Pinterest"],
    react: "📌",
    desc: "Download Pinterest images",
    category: "download",
    use: ".pindl <Pinterest image link>",
    filename: __filename
}, async (conn, mek, m, { from, reply, args, q }) => {
    try {
        const url = q || args[0];

        if (!url) return reply("⚠️ Please provide a Pinterest link.\nExample: .pindl https://pin.it/xxx");

        const validDomains = ["pin.it", "pinterest.com", "pinterest.co.uk", "pinterest.ca"];
        if (!validDomains.some(d => url.includes(d))) return reply("⚠️ Please provide a valid Pinterest link.");

        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

        const links = await getPinloadLinks(url);

        if (!links.length) return reply("❌ Could not get download link. Please try again.");

        await conn.sendMessage(from, {
            image: { url: links[0] },
            caption: `📌 *PINTEREST IMAGE*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ 👑`
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });

    } catch (error) {
        console.error("Pinterest image error:", error.message);
        reply(`❌ Error: ${error.message}`);
        try { await conn.sendMessage(from, { react: { text: "❌", key: mek.key } }); } catch {}
    }
});

// ===== VIDEO COMMAND =====
cmd({
    pattern: "pin2",
    alias: ["pinvid", "pinterestvideo", "pinvideo"],
    react: "📌",
    desc: "Download Pinterest videos",
    category: "download",
    use: ".pin2 <Pinterest video link>",
    filename: __filename
}, async (conn, mek, m, { from, reply, args, q }) => {
    try {
        const url = q || args[0];

        if (!url) return reply("⚠️ Please provide a Pinterest link.\nExample: .pin2 https://pin.it/xxx");

        const validDomains = ["pin.it", "pinterest.com", "pinterest.co.uk", "pinterest.ca"];
        if (!validDomains.some(d => url.includes(d))) return reply("⚠️ Please provide a valid Pinterest link.");

        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

        const links = await getPinloadLinks(url);

        if (!links.length) return reply("❌ Could not get download link. Please try again.");

        await conn.sendMessage(from, {
            video: { url: links[0] },
            caption: `🌐 *PINTEREST VIDEO*\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ 👑`,
            mimetype: "video/mp4"
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });

    } catch (error) {
        console.error("Pinterest video error:", error.message);
        reply(`❌ Error: ${error.message}`);
        try { await conn.sendMessage(from, { react: { text: "❌", key: mek.key } }); } catch {}
    }
});
