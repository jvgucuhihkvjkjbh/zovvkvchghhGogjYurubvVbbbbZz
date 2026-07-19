const axios = require("axios");
const { cmd } = require("../command");

const SEARCH_API = "https://adeel-xtech-api.vercel.app/api/ytsearch";
const YTMP3_API = "https://adeel-xtech-api.vercel.app/api/ytmp3";

cmd({
    pattern: "ytmp3",
    alias: ["ytaudio", "ytsong", "ymp3"],
    react: "🎧",
    desc: "Search and download YouTube audio by name",
    category: "downloader",
    filename: __filename
}, async (conn, message, m, { reply, args, q }) => {
    try {
        const query = q || args.join(" ");

        if (!query) {
            return reply("❌ Song ka naam likho\n\nMisal: .ytmp3 Judaai Maar Deti Hai");
        }

        if (/youtu\.?be|youtube\.com/i.test(query)) {
            return reply("❌ Link nahi, sirf song ka naam likho\n\nMisal: .ytmp3 Judaai Maar Deti Hai");
        }

        await conn.sendMessage(m.chat, {
            react: { text: "🔎", key: message.key }
        });

        const searchRes = await axios.get(`${SEARCH_API}?query=${encodeURIComponent(query)}`, { timeout: 30000 });
        const searchData = searchRes.data;

        const firstResult = searchData?.result?.[0] || searchData?.results?.[0] || searchData?.data?.[0];

        if (!searchData || searchData.status !== true || !firstResult) {
            await conn.sendMessage(m.chat, { react: { text: "❌", key: message.key } });
            return reply("❌ Song nahi mila. Naam dobara check karke likho.");
        }

        const videoUrl = firstResult.url || firstResult.link || (firstResult.videoId ? `https://youtu.be/${firstResult.videoId}` : null);

        if (!videoUrl) {
            await conn.sendMessage(m.chat, { react: { text: "❌", key: message.key } });
            return reply("❌ Song ka link nahi mila. Dobara try karo.");
        }

        await conn.sendMessage(m.chat, {
            react: { text: "⏳", key: message.key }
        });

        const response = await axios.get(`${YTMP3_API}?url=${encodeURIComponent(videoUrl)}`, { timeout: 60000 });
        const data = response.data;

        if (!data || data.status !== true || !data.result || !data.result.audio_download) {
            await conn.sendMessage(m.chat, { react: { text: "❌", key: message.key } });
            return reply("❌ Audio download nahi ho saka.");
        }

        const { title, duration, quality, audio_download } = data.result;

        await conn.sendMessage(m.chat, {
            audio: { url: audio_download },
            mimetype: "audio/mpeg",
            fileName: `${title || query}.mp3`
        }, { quoted: m });

        await conn.sendMessage(
            m.chat,
            {
                text: `\`YOUTUBE AUDIO DOWNLOADER\`\n\n📝 TITLE: ${title || query}\n⏱️ DURATION: ${duration || "N/A"}\n🎚️ QUALITY: ${quality || "N/A"}\n\n> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ 🍸*`
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
