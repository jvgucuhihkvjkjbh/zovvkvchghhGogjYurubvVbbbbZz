const { cmd } = require('../command');
const axios = require('axios');

cmd({
    pattern: "capcut",
    alias: ["ccdl", "capcutdl"],
    desc: "Download CapCut video (No Watermark)",
    category: "download",
    react: "🎬",
    filename: __filename
}, async (conn, mek, m, { args, reply, q }) => {
    try {
        if (!q) return reply("🎥 *Please provide a CapCut video link!*");

        const apiUrl = `https://rynekoo-api.vercel.app/dwn/capcut?url=${encodeURIComponent(q)}`;
        
        const res = await axios.get(apiUrl);
        const data = res.data;

        if (!data.success || !data.result) {
            return reply("⚠️ *Failed to fetch video. Please check the link!*");
        }

        const result = data.result;
        const video = result.videoUrl;
        const title = result.title || "CapCut Video";
        const author = result.author ? result.author.name : "Unknown User";

        // Stylish Caption with your exact name format
        let caption = `🎬 *CAPCUT DOWNLOADER*\n\n`;
        caption += `📝 *Title:* ${title}\n`;
        caption += `👤 *Author:* ${author}\n\n`;
        caption += `> ᴘᴏᴡᴇʀᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ 🪸`;

        await conn.sendMessage(
            mek.chat,
            {
                video: { url: video },
                caption: caption,
                mimetype: "video/mp4"
            },
            { quoted: mek }
        );

    } catch (e) {
        console.error('Capcut Error:', e.message);
        reply("❌ *An error occurred while processing your request!*");
    }
});
