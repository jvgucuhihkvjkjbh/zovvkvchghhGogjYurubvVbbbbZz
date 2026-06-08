const { cmd } = require('../command');
const axios = require('axios');
const cheerio = require('cheerio');

async function searchSubtitles(query) {
    const res = await axios.get(
        `https://jerrycoder.oggyapi.workers.dev/subtitle/search?q=${encodeURIComponent(query)}`,
        { timeout: 15000 }
    );
    return res.data?.data || [];
}

async function getSubtitleLinks(pageUrl) {
    const res = await axios.get(pageUrl, { timeout: 15000 });
    const $ = cheerio.load(res.data);
    const links = {};

    $('a[href$=".srt"]').each((i, el) => {
        const href = $(el).attr('href');
        const text = $(el).closest('p, div').text().trim();
        const lang = text.split('\n')[0].trim();
        if (href && lang) {
            const fullUrl = href.startsWith('http') ? href : `https://www.subtitlecat.com${href}`;
            links[lang] = fullUrl;
        }
    });

    return links;
}

cmd({
    pattern: "subtitle",
    alias: ["sub", "srt", "subtitledl"],
    desc: "Search and download subtitles",
    category: "download",
    react: "📝",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("❌ Movie ka naam likho\nMisal: .subtitle My Fault London 2025");

        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

        // Step 1 — Search
        let results;
        try {
            results = await searchSubtitles(q);
        } catch (e) {
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply("❌ Search failed. Try again.");
        }

        if (!results || results.length === 0) {
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply(`❌ Koi subtitle nahi mila: *${q}*`);
        }

        // Sabse zyada downloads wala lo
        const best = results.reduce((a, b) => {
            const aD = parseInt(b.languages) || 0;
            const bD = parseInt(a.languages) || 0;
            return aD > bD ? b : a;
        });

        // Step 2 — Page se SRT links nikalo
        let links;
        try {
            links = await getSubtitleLinks(best.url);
        } catch (e) {
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply("❌ Subtitle links nahi mile.");
        }

        // Urdu pehle, phir English, phir jo mile
        const preferred = links["Urdu"] || links["English"] || Object.values(links)[0];

        if (!preferred) {
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply("❌ Download link nahi mili.");
        }

        const lang = links["Urdu"] ? "Urdu" : links["English"] ? "English" : Object.keys(links)[0];

        await conn.sendMessage(from, {
            document: { url: preferred },
            mimetype: "application/x-subrip",
            fileName: `${best.title}.srt`,
            caption: `📝 *${best.title}*\n\n🌐 *Language:* ${lang}\n📦 *Size:* ${best.downloads?.replace('SIZE', '') || 'N/A'}\n\n> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡*`
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });

    } catch (e) {
        console.log("Subtitle Error:", e.message);
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply("❌ Error occurred. Try again.");
    }
});
