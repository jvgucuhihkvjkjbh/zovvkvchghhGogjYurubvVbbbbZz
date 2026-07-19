const axios = require("axios");
const { cmd } = require("../command");

const YTMP3_API = "https://adeel-xtech-api.vercel.app/api/ytmp3";

cmd({
    pattern: "ytmp3",
    alias: ["ytaudio", "ytsong", "ymp3"],
    react: "🎧",
    desc: "Search & download YouTube audio by song name",
    category: "downloader",
    filename: __filename
}, async (conn, message, m, { reply, args, q }) => {
    try {
        const query = q || args.join(" ");

        if (!query) {
            return reply("*🎵 YT MUSIC DOWNLOADER*\n\nPlease provide a song name.\n\n*Example:* .ytmp3 Judaai Maar Deti Hai");
        }

        if (/youtu\.?be|youtube\.com/i.test(query)) {
            return reply("*🎵 YT MUSIC DOWNLOADER*\n\nLinks are not supported, please enter only the song name.\n\n*Example:* .ytmp3 Judaai Maar Deti Hai");
        }

        await conn.sendMessage(m.chat, {
            react: { text: "⏳", key: message.key }
        });

        const response = await axios.get(`${YTMP3_API}?url=${encodeURIComponent(query)}`, { timeout: 60000 });
        const data = response.data;

        if (!data || data.status !== true || !data.result || !data.result.audio_download) {
            await conn.sendMessage(m.chat, { react: { text: "❌", key: message.key } });
            return reply("*🎵 YT MUSIC DOWNLOADER*\n\nNo results found. Please try a different song name.");
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
                text: `╭─❖ *YT MUSIC DOWNLOADER* ❖─╮\n\n` +
                      `🎼 *Title:* ${title || query}\n` +
                      `⏱️ *Duration:* ${duration || "N/A"}\n` +
                      `🎚️ *Quality:* ${quality || "N/A"}\n\n` +
                      `╰──────────────────╯\n` +
                      `> *⚡ Powered by ADEEL-MD ⚡*`
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
        reply(`*🎵 YT MUSIC DOWNLOADER*\n\nSomething went wrong: ${apiError}`);
    }
});
