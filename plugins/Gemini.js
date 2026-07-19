const axios = require("axios");
const { cmd } = require("../command");

const API_URL = "https://adeel-xtech-api.vercel.app/api/ytmp3";

cmd({
    pattern: "ytmp3",
    alias: ["ytaudio", "ytsong", "ymp3"],
    react: "🎧",
    desc: "Download YouTube audio (MP3)",
    category: "downloader",
    filename: __filename
}, async (conn, message, m, { reply, args, q }) => {
    try {
        const url = q || args[0];

        if (!url) {
            return reply("❌ Please provide a YouTube URL\n\nExample: .ytmp3 https://youtu.be/xxxxx");
        }

        if (!url.includes("youtu")) {
            return reply("❌ Please provide a valid YouTube URL");
        }

        await conn.sendMessage(m.chat, {
            react: { text: "⏳", key: message.key }
        });

        const response = await axios.get(`${API_URL}?url=${encodeURIComponent(url)}`, { timeout: 60000 });
        const data = response.data;

        if (!data || data.status !== true || !data.result || !data.result.audio_download) {
            return reply("❌ Failed to fetch YouTube audio");
        }

        const { title, duration, quality, audio_download } = data.result;

        await conn.sendMessage(m.chat, {
            audio: { url: audio_download },
            mimetype: "audio/mpeg",
            fileName: `${title || "audio"}.mp3`
        }, { quoted: m });

        await conn.sendMessage(
            m.chat,
            {
                text: `\`YOUTUBE AUDIO DOWNLOADER\`\n\n📝 TITLE: ${title || "N/A"}\n⏱️ DURATION: ${duration || "N/A"}\n🎚️ QUALITY: ${quality || "N/A"}\n\n> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ 🍸*`
            },
            { quoted: m }
        );

        await conn.sendMessage(m.chat, {
            react: { text: "✅", key: message.key }
        });

    } catch (err) {
        console.log("YTMP3 Error:", err.message);

        await conn.sendMessage(m.chat, {
            react: { text: "❌", key: message.key }
        });

        const apiError = err.response?.data?.error || err.message;
        reply(`❌ Error: ${apiError}`);
    }
});
