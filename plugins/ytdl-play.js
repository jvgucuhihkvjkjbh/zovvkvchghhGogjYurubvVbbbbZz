const { cmd } = require('../command');
const axios = require('axios');
const yts = require('yt-search');

cmd({
    pattern: "play",
    alias: ["song", "mp3"],
    desc: "Download YouTube audio via Adeel-Xtech API",
    category: "download",
    react: "🎶",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) {
            return reply("❌ Please provide a song name or YouTube link!");
        }

        let videoUrl = q;
        let ytInfo = null;

        const isYT = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(q);

        if (!isYT) {
            const searchResults = await yts(q);
            if (!searchResults || !searchResults.videos.length) {
                return reply("❌ No song results found on YouTube!");
            }
            ytInfo = searchResults.videos[0];
            videoUrl = ytInfo.url;
        }

        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

        const apiUrl = `https://adeel-xtech-apis.vercel.app/api/ytmp3?url=${encodeURIComponent(videoUrl)}`;
        const { data } = await axios.get(apiUrl, { timeout: 35000 });

        if (!data || !data.status || !data.result || !data.result.audio_download) {
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply("❌ Failed to fetch audio from server. Please try again later.");
        }

        const res = data.result;

        const title = ytInfo ? ytInfo.title : res.title;
        const author = ytInfo ? ytInfo.author.name : res.author;
        const duration = ytInfo ? ytInfo.timestamp : res.duration;
        const thumbnail = ytInfo ? ytInfo.thumbnail : res.thumbnail;

        const caption = 
`🎵 *${title || 'YouTube Song'}*\n\n` +
`👤 *Channel:* ${author || 'YouTube'}\n` +
`⏱ *Duration:* ${duration || 'N/A'}\n\n` +
`> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡*`;

        if (thumbnail) {
            await conn.sendMessage(from, {
                image: { url: thumbnail },
                caption: caption
            }, { quoted: mek });
        }

        await conn.sendMessage(from, {
            audio: { url: res.audio_download },
            mimetype: "audio/mpeg",
            fileName: `${title || 'song'}.mp3`
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });

    } catch (e) {
        console.error("Play Command Error:", e.message);
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply("❌ An unexpected error occurred while processing your request.");
    }
});
