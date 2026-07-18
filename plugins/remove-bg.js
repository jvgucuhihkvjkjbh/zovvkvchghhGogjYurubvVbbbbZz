const axios = require("axios");
const { cmd } = require("../command");

const API_URL = "https://adeel-xtech-api.vercel.app/api/ttdl";

cmd({
    pattern: "aatt",
    react: "🎵",
    desc: "Download TikTok video",
    category: "downloader",
    filename: __filename
}, async (conn, message, m, { reply, args, q }) => {
    try {
        const url = q || args[0];

        if (!url) {
            return reply("❌ Please provide a TikTok URL\n\nExample: .tiktok https://vt.tiktok.com/xxxxx");
        }

        if (!url.includes("tiktok.com")) {
            return reply("❌ Please provide a valid TikTok URL");
        }

        await conn.sendMessage(m.chat, {
            react: { text: "⏳", key: message.key }
        });

        const response = await axios.get(`${API_URL}?url=${encodeURIComponent(url)}`, { timeout: 60000 });
        const data = response.data;

        if (!data || data.status !== true || !data.result || !data.result.video) {
            return reply("❌ Failed to fetch TikTok video");
        }

        const { title, video } = data.result;

        const videoRes = await axios.get(video, {
            responseType: "arraybuffer",
            timeout: 60000
        });
        const videoBuffer = Buffer.from(videoRes.data);

        const formatBytes = (bytes) => {
            if (bytes === 0) return "0 Bytes";
            const k = 1024;
            const sizes = ["Bytes", "KB", "MB"];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
        };

        const size = formatBytes(videoBuffer.length);

        await conn.sendMessage(m.chat, {
            react: { text: "✅", key: message.key }
        });

        await conn.sendMessage(
            m.chat,
            {
                video: videoBuffer,
                mimetype: "video/mp4",
                caption: `\`TIKTOK DOWNLOADER\`\n\n📝 TITLE: ${title || "N/A"}\n📦 SIZE: ${size}\n\n> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ 🍸*`
            },
            { quoted: m }
        );

    } catch (err) {
        console.log("TikTok DL Error:", err.message);

        await conn.sendMessage(m.chat, {
            react: { text: "❌", key: message.key }
        });

        const apiError = err.response?.data?.error || err.message;
        reply(`❌ Error: ${apiError}`);
    }
});
