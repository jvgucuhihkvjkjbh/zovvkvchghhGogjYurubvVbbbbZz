const { cmd } = require('../command');
const axios = require('axios');

cmd({
    pattern: "snap",
    alias: ["snapchat", "ssdown"],
    desc: "Download Snapchat Spotlight Videos",
    category: "downloader",
    react: "👻",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {

        if (!q) {
            return reply("❌ Please provide a Snapchat link.");
        }

        if (!q.includes("snapchat.com")) {
            return reply("❌ Invalid Snapchat URL. Please provide a valid link.");
        }

        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

        const res = await axios.get(`https://jerrycoder.oggyapi.workers.dev/down/snap?url=${encodeURIComponent(q)}`, { timeout: 30000 });
        const data = res.data;

        if (data.status !== "success" || !data.medias || !data.medias.length) {
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply("❌ Failed to fetch video or no video media found.");
        }

        const videoTitle = data.title || "Snapchat Video";
        const durationMs = data.duration ? parseInt(data.duration) : 0;
        const durationSec = durationMs ? Math.floor(durationMs / 1000) : "N/A";

        const videoUrl = data.medias[0].url;
        if (!videoUrl) {
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply("❌ Download link not found in the response.");
        }

        const cleanTitle = videoTitle.length > 100 ? videoTitle.substring(0, 100) + "..." : videoTitle;
        const captionText = `*🎬 TITLE:* ${cleanTitle}\n⏱️ *DURATION:* ${durationSec}s\n\n` + `> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡*`;

        await conn.sendMessage(from, { video: { url: videoUrl }, caption: captionText }, { quoted: mek });
        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });

    } catch (err) {
        console.log("SNAP DOWNLOAD ERROR:", err.message);
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply("❌ An unexpected error occurred while processing your request.");
    }
});
