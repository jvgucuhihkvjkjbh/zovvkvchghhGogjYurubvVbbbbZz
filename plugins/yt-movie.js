const { cmd } = require('../command');
const axios = require('axios');

const MOVIE_API = "https://movieapi.giftedtech.co.ke";

async function searchMovie(query) {
    const res = await axios.get(
        `${MOVIE_API}/api/search/${encodeURIComponent(query)}`,
        { timeout: 15000 }
    );
    return res.data;
}

async function getMovieSources(subjectId) {
    const res = await axios.get(
        `${MOVIE_API}/api/sources/${subjectId}`,
        { timeout: 15000 }
    );
    return res.data;
}

cmd({
    pattern: "movie",
    alias: ["film", "moviedl"],
    desc: "Search and download movies",
    category: "download",
    react: "🎬",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("❌ Movie ka naam likho\nMisal: .movie Black Panther");

        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

        // Step 1 — Search
        let searchData;
        try {
            searchData = await searchMovie(q);
        } catch (e) {
            console.log("Movie Search Error:", e.message);
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply("❌ Search failed. Try again.");
        }

        // results.items[] array hai
        const items = searchData?.results?.items;
        if (!items || items.length === 0) {
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply(`❌ Koi movie nahi mili: *${q}*`);
        }

        const movie = items[0];
        const subjectId = movie.subjectId;
        const title = movie.title || "Unknown";
        const year = movie.releaseDate?.split("-")[0] || "N/A";
        const rating = movie.imdbRatingValue || "N/A";
        const genre = movie.genre || "N/A";
        const description = movie.description || "";
        const thumbnail = movie.cover?.url || movie.thumbnail || "";
        const duration = movie.duration ? `${Math.floor(movie.duration / 60)}min` : "N/A";

        // Step 2 — Get download sources
        let sourcesData;
        try {
            sourcesData = await getMovieSources(subjectId);
        } catch (e) {
            console.log("Movie Sources Error:", e.message);
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply("❌ Download sources nahi mile.");
        }

        const sources = sourcesData?.results;
        if (!sources || sources.length === 0) {
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply("❌ Is movie ka download link available nahi hai.");
        }

        // 480p prefer, phir 360p, phir jo mile
        const preferred = sources.find(s => s.quality === "480p")
            || sources.find(s => s.quality === "360p")
            || sources[0];

        const downloadUrl = preferred?.download_url;
        const quality = preferred?.quality || "N/A";
        const sizeMB = preferred?.size
            ? `${(parseInt(preferred.size) / (1024 * 1024)).toFixed(0)}MB`
            : "N/A";

        if (!downloadUrl) {
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply("❌ Download URL nahi mili.");
        }

        // Step 3 — Send thumbnail + info
        const caption =
            `🎬 *${title}*\n\n` +
            `📅 *Year:* ${year}\n` +
            `⏳ *Duration:* ${duration}\n` +
            `⭐ *Rating:* ${rating}\n` +
            `🎭 *Genre:* ${genre}\n` +
            `📦 *Quality:* ${quality} • ${sizeMB}\n` +
            `📝 *Overview:* ${description.slice(0, 200)}${description.length > 200 ? "..." : ""}\n\n` +
            `> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡*`;

        if (thumbnail) {
            await conn.sendMessage(from, {
                image: { url: thumbnail },
                caption: caption
            }, { quoted: mek });
        } else {
            await reply(caption);
        }

        // Step 4 — Send video
        await conn.sendMessage(from, {
            video: { url: downloadUrl },
            mimetype: "video/mp4",
            caption: `*${title}* (${year}) • ${quality}\n\n> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡*`
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });

    } catch (e) {
        console.log("Movie Command Error:", e.message);
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply("❌ Error occurred. Try again.");
    }
});
