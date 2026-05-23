const { cmd } = require('../command');
const axios = require('axios');

const API = "https://jerrycoder.oggyapi.workers.dev/down/applem";

cmd({
    pattern: "applemusic",
    alias: ["amusic", "applemp3"],
    desc: "Download Apple Music song",
    category: "download",
    react: "🎵",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {

    try {

        if (!q) {
            return reply("❌ Please send Apple Music song link");
        }

        await conn.sendMessage(from, {
            react: { text: "⏳", key: mek.key }
        });

        const api = `${API}?url=${encodeURIComponent(q)}`;

        const { data } = await axios.get(api, {
            timeout: 60000,
            headers: {
                "User-Agent": "Mozilla/5.0"
            }
        });

        if (
            data.status !== "success" ||
            !data.result ||
            !data.result.download
        ) {
            await conn.sendMessage(from, {
                react: { text: "❌", key: mek.key }
            });

            return reply("❌ Failed to fetch song");
        }

        const song = data.result;

        const caption =
`🎵 *APPLE MUSIC DOWNLOADER*

📌 *TITLE:* ${song.title}
👤 *ARTIST:* ${song.artist}

> *⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡*`;

        if (song.thumbnail) {
            await conn.sendMessage(from, {
                image: { url: song.thumbnail },
                caption
            }, { quoted: mek });
        }

        await conn.sendMessage(from, {
            audio: { url: song.download },
            mimetype: "audio/mpeg",
            fileName: `${song.title}.mp3`,
            ptt: false
        }, { quoted: mek });

        await conn.sendMessage(from, {
            react: { text: "✅", key: mek.key }
        });

    } catch (e) {

        console.log("Apple Music Error:", e.message);

        await conn.sendMessage(from, {
            react: { text: "❌", key: mek.key }
        });

        reply("❌ Download failed, try again");
    }
});
