const { cmd } = require('../command');
const axios = require('axios');
const yts = require('yt-search');

const AXIOS_DEFAULTS = {
    timeout: 60000,
    headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json'
    }
};

async function getJerryDownload(url) {
    try {
        const api = `https://jerrycoder.oggyapi.workers.dev/down/ytmp4?url=${encodeURIComponent(url)}`;

        const res = await axios.get(api, AXIOS_DEFAULTS);

        if (
            res.data &&
            res.data.status === "success" &&
            res.data.url
        ) {
            return res.data.url;
        }

        return null;

    } catch (e) {
        console.log("Jerry API 1 Error:", e.message);
        return null;
    }
}

async function getJerryBackup(url) {
    try {
        const api = `https://jerrycoder.oggyapi.workers.dev/down/ytmp4-v1?url=${encodeURIComponent(url)}`;

        const res = await axios.get(api, AXIOS_DEFAULTS);

        if (
            res.data &&
            res.data.status === "success" &&
            res.data.url
        ) {
            return res.data.url;
        }

        return null;

    } catch (e) {
        console.log("Jerry API 2 Error:", e.message);
        return null;
    }
}

async function getJawadDownload(url) {
    try {
        const api = `https://jawad-tech.vercel.app/download/ytdl?url=${encodeURIComponent(url)}`;

        const res = await axios.get(api, AXIOS_DEFAULTS);

        if (
            res.data &&
            res.data.status &&
            res.data.result &&
            res.data.result.mp4
        ) {
            return res.data.result.mp4;
        }

        return null;

    } catch (e) {
        console.log("Jawad API Error:", e.message);
        return null;
    }
}

cmd({
    pattern: "video",
    alias: ["mp4"],
    desc: "Download video by name or link",
    category: "download",
    react: "🎬",
    filename: __filename
}, async (sock, message, m, { q }) => {

    const query = q ? q.trim() : "";

    if (!query) {
        return await sock.sendMessage(
            message.chat,
            {
                text: "❌ Please provide a video name or YouTube link"
            },
            { quoted: message }
        );
    }

    try {

        let video;

        const isYT = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(query);

        if (isYT) {

            const search = await yts({
                videoId: query.split("v=")[1] || query.split("/").pop().split("?")[0]
            });

            if (!search.videos.length) {
                return sock.sendMessage(
                    message.chat,
                    {
                        text: "❌ Invalid YouTube link"
                    },
                    { quoted: message }
                );
            }

            video = search.videos[0];

        } else {

            const search = await yts(query);

            if (!search.videos.length) {
                return sock.sendMessage(
                    message.chat,
                    {
                        text: "❌ No video results found"
                    },
                    { quoted: message }
                );
            }

            video = search.videos[0];
        }

        const footer = "⚡ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ";

        const captionText = `*${video.title}*

🎥 *CHANNEL:* ${video.author.name}
👁️ *VIEWS:* ${video.views.toLocaleString()}
⏳ *DURATION:* ${video.timestamp}

> *${footer}*`;

        await sock.sendMessage(message.chat, {
            image: { url: video.thumbnail },
            caption: captionText
        }, { quoted: message });

        await sock.sendMessage(message.chat, {
            react: {
                text: "⏳",
                key: message.key
            }
        });

        let downUrl = null;

        if (!downUrl) {
            downUrl = await getJerryDownload(video.url);
        }

        if (!downUrl) {
            console.log("API 1 failed, trying API 2...");
            downUrl = await getJerryBackup(video.url);
        }

        if (!downUrl) {
            console.log("API 2 failed, trying API 3...");
            downUrl = await getJawadDownload(video.url);
        }

        if (!downUrl) {
            return sock.sendMessage(
                message.chat,
                {
                    text: "❌ All download servers are currently unavailable. Please try again later."
                },
                { quoted: message }
            );
        }

        await sock.sendMessage(message.chat, {
            react: {
                text: "✅",
                key: message.key
            }
        });

        await sock.sendMessage(message.chat, {
            video: { url: downUrl },
            mimetype: "video/mp4",
            caption: `*${video.title}*

> *${footer}*`
        }, { quoted: message });

    } catch (err) {

        console.log("Video Command Error:", err);

        await sock.sendMessage(
            message.chat,
            {
                text: "❌ An unexpected error occurred while processing your request."
            },
            { quoted: message }
        );
    }
});
