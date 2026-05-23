const { cmd } = require('../command');
const axios = require('axios');

cmd({
    pattern: "applemusic",
    alias: ["applem", "amsong"],
    desc: "Search and download Apple Music songs",
    category: "download",
    react: "🎵",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {

    try {

        if (!q) {
            return reply("❌ Please provide a song name");
        }

        await conn.sendMessage(from, {
            react: { text: "⏳", key: mek.key }
        });

        // Search API
        const searchApi = `https://jerrycoder.oggyapi.workers.dev/search/applem?q=${encodeURIComponent(q)}&limit=1`;

        const searchRes = await axios.get(searchApi, {
            timeout: 30000,
            headers: {
                "User-Agent": "Mozilla/5.0"
            }
        });

        const searchData = searchRes.data;

        if (
            searchData.status !== "success" ||
            !searchData.results ||
            !searchData.results.length
        ) {
            return reply("❌ Song not found");
        }

        const song = searchData.results[0];

        // Download API
        const downloadApi =
            `https://jerrycoder.oggyapi.workers.dev/down/applem?url=${encodeURIComponent(song.url)}`;

        const downloadRes = await axios.get(downloadApi, {
            timeout: 30000,
            headers: {
                "User-Agent": "Mozilla/5.0"
            }
        });

        const downloadData = downloadRes.data;

        if (
            downloadData.status !== "success" ||
            !downloadData.result ||
            !downloadData.result.download
        ) {
            return reply("❌ Download failed, try again");
        }

        const audioUrl = downloadData.result.download;

        const caption =
`🎵 *${song.title}*

👤 *Artist:* ${song.artist}
💽 *Album:* ${song.album}
🎼 *Genre:* ${song.genre}
⏱️ *Duration:* ${Math.floor(song.duration / 60)}:${String(song.duration % 60).padStart(2, '0')}

> *⚡ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡*`;

        // Thumbnail
        await conn.sendMessage(from, {
            image: { url: song.thumbnail },
            caption
        }, { quoted: mek });

        // Audio
        await conn.sendMessage(from, {
            audio: { url: audioUrl },
            mimetype: "audio/mpeg",
            fileName: `${song.title}.mp3`
        }, { quoted: mek });

        await conn.sendMessage(from, {
            react: { text: "✅", key: mek.key }
        });

    } catch (e) {

        console.log("Apple Music Error:", e.message);

        await conn.sendMessage(from, {
            react: { text: "❌", key: mek.key }
        });

        reply("❌ Error occurred while processing request");
    }
});
