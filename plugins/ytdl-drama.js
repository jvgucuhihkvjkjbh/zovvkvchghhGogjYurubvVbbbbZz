const { cmd } = require('../command');
const axios = require('axios');
const yts = require('yt-search');

const AXIOS_DEFAULTS = { 
    timeout: 60000, 
    headers: { 'User-Agent': 'Mozilla/5.0' } 
};

async function getDownloadLink(url) {
    try {
        const res = await axios.get(
            `https://jerrycoder.oggyapi.workers.dev/down/ytmp4?url=${encodeURIComponent(url)}`,
            AXIOS_DEFAULTS
        );
        if (res.data?.status === "success" && res.data?.url) return res.data.url;
    } catch (e) {
        console.log("Jerry API 1 Error:", e.message);
    }

    try {
        const res = await axios.get(
            `https://jerrycoder.oggyapi.workers.dev/down/ytmp4-v1?url=${encodeURIComponent(url)}`,
            AXIOS_DEFAULTS
        );
        if (res.data?.status === "success" && res.data?.url) return res.data.url;
    } catch (e) {
        console.log("Jerry API 2 Error:", e.message);
    }

    try {
        const res = await axios.get(
            `https://jawad-tech.vercel.app/download/ytdl?url=${encodeURIComponent(url)}`,
            AXIOS_DEFAULTS
        );
        if (res.data?.status && res.data?.result?.mp4) return res.data.result.mp4;
    } catch (e) {
        console.log("Jawad API Error:", e.message);
    }

    return null;
}

cmd({
    pattern: "drama",
    alias: ["darama"],
    desc: "Download YouTube dramas only (≥15 min) by name",
    category: "download",
    react: "🎬",
    filename: __filename
}, async (sock, message, m, { q, reply }) => {
    try {
        if (!q) return reply("⚠️ Please provide a Drama Name or Video Title!");

        if (q.includes("youtube.com/") || q.includes("youtu.be/")) 
            return reply("❌ Links are not allowed. Please type the name only!");

        const search = await yts(q);
        const video = search.videos.find(v => v.seconds >= 900);
        if (!video) return reply("❌ No suitable drama found (≥15 min)!");

        const customName = "> *⚡ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ⚡*";
        const videoTitle = video.title;

        const captionBox = `╭━〔 *YT DOWNLOADER* 〕━┈⊷
┃ 🎬 *TITLE:* ${videoTitle}
┃ ⏱️ *DURATION:* ${video.timestamp}
┃ 👁️ *VIEWS:* ${video.views.toLocaleString()}
┃ 📺 *CHANNEL:* ${video.author.name}
╰━━━━━━━━━━━━━━━━┈⊷

*ᴘʟᴇᴀsᴇ ʀᴇᴘʟʏ ᴡɪᴛʜ ᴀ ɴᴜᴍʙᴇʀ*
(1) 📂 *ᴅᴏᴄᴜᴍᴇɴᴛ*
(2) 🎥 *ᴠɪᴅᴇᴏ*

${customName}`;

        const sentMsg = await sock.sendMessage(message.chat, {
            image: { url: video.thumbnail },
            caption: captionBox
        }, { quoted: message });

        const listener = async (chatUpdate) => {
            const msg = chatUpdate.messages[0];
            if (!msg.message?.extendedTextMessage) return;

            const selectedText = msg.message.extendedTextMessage.text.trim();
            const context = msg.message.extendedTextMessage.contextInfo;
            const isReplyToBot = context && context.stanzaId === sentMsg.key.id;
            if (!isReplyToBot) return;

            if (!["1","2"].includes(selectedText)) return;

            await sock.sendMessage(message.chat, { 
                react: { text: "⏳", key: msg.key } 
            });

            const dlUrl = await getDownloadLink(video.url);
            if (!dlUrl) {
                await sock.sendMessage(message.chat, { 
                    react: { text: "❌", key: msg.key } 
                });
                return reply("❌ All download servers are currently unavailable. Please try again later.");
            }

            const response = await axios.get(dlUrl, { responseType: "arraybuffer", timeout: 120000 });
            const buffer = Buffer.from(response.data);

            if (selectedText === "1") {
                await sock.sendMessage(message.chat, {
                    document: buffer,
                    mimetype: "video/mp4",
                    fileName: `${videoTitle}.mp4`,
                    caption: `*${videoTitle}*`
                }, { quoted: msg });
            } else if (selectedText === "2") {
                await sock.sendMessage(message.chat, {
                    video: buffer,
                    mimetype: "video/mp4",
                    caption: `*${videoTitle}*\n\n${customName}`
                }, { quoted: msg });
            }

            await sock.sendMessage(message.chat, { 
                react: { text: "✅", key: msg.key } 
            });

            sock.ev.off("messages.upsert", listener);
        };

        sock.ev.on("messages.upsert", listener);
        setTimeout(() => sock.ev.off("messages.upsert", listener), 120000);

    } catch (e) {
        console.error(e);
        reply("❌ System error occurred.");
    }
});
