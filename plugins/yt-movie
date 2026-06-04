const { cmd } = require('../command');
const axios = require('axios');

const MOVIE_API = "https://movieapi.giftedtech.co.ke";

async function searchMovie(query) {
    const res = await axios.get(`${MOVIE_API}/api/search/${encodeURIComponent(query)}`, { timeout: 15000 });
    return res.data;
}

async function getMovieInfo(movieId) {
    const res = await axios.get(`${MOVIE_API}/api/info/${movieId}`, { timeout: 15000 });
    return res.data;
}

async function getDownloadSources(movieId) {
    const res = await axios.get(`${MOVIE_API}/api/sources/${movieId}`, { timeout: 15000 });
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
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply("❌ Search failed. Try again.");
        }

        const results = searchData?.results;
        if (!results || !results.length) {
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply("❌ Koi movie nahi mili: *" + q + "*");
        }

        // Pehli movie lo
        const movie = results[0];
        const movieId = movie.subjectId || movie.id;
        const title = movie.title || "Unknown";
        const year = movie.releaseDate?.split("-")[0] || "N/A";
        const rating = movie.imdbRatingValue || "N/A";
        const genre = movie.genre || "N/A";
        const description = movie.description || "";
        const thumbnail = movie.cover?.url || movie.thumbnail || "";

        // Step 2 — Get download sources
        let sourcesData;
        try {
            sourcesData = await getDownloadSources(movieId);
        } catch (e) {
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply("❌ Download sources nahi mile.");
        }

        const sources = sourcesData?.results?.sources || sourcesData?.results || [];

        if (!sources || sources.length === 0) {
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply("❌ Is movie ka download link available nahi hai.");
        }

        // Best quality lo — 480p prefer karo, nahi to jo mile
        const preferred = sources.find(s => s.quality === 480 || s.resolution === 480)
            || sources.find(s => s.quality === 360 || s.resolution === 360)
            || sources[0];

        const downloadUrl = preferred?.url || preferred?.videoUrl || preferred?.link;

        if (!downloadUrl) {
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply("❌ Download URL nahi mili.");
        }

        // Step 3 — Send thumbnail + info
        const caption =
            `🎬 *${title}*\n\n` +
            `📅 *Year:* ${year}\n` +
            `⭐ *Rating:* ${rating}\n` +
            `🎭 *Genre:* ${genre}\n` +
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
            caption: `*${title}* (${year})\n\n> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡*`
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });

    } catch (e) {
        console.log("Movie Command Error:", e.message);
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply("❌ Error occurred. Try again.");
    }
});
