const { cmd } = require('../command');
const axios = require('axios');
const yts = require('yt-search');

// ہر API کال کے لیے ڈاؤن لوڈنگ ٹائم آؤٹ 1 منٹ (60000ms) سیٹ ہے
const AXIOS_DEFAULTS = {
    timeout: 60000,
    headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json'
    }
};

async function getPrinceDownload1(url) {
    try {
        const api = `https://api.princetechn.com/api/download/ytmp4?apikey=prince&url=${encodeURIComponent(url)}`;
        const res = await axios.get(api, AXIOS_DEFAULTS);
        if (res.data?.success && res.data?.result && !res.data.result.error) {
            return res.data.result.url || res.data.result.download_url || null;
        }
        return null;
    } catch (e) {
        console.log("Prince API 1 Error:", e.message);
        return null;
    }
}

async function getPrinceDownload2(url) {
    try {
        const api = `https://api.princetechn.com/api/download/mp4?apikey=prince&url=${encodeURIComponent(url)}`;
        const res = await axios.get(api, AXIOS_DEFAULTS);
        if (res.data?.success && res.data?.result && !res.data.result.error) {
            return res.data.result.url || res.data.result.download_url || null;
        }
        return null;
    } catch (e) {
        console.log("Prince API 2 Error:", e.message);
        return null;
    }
}

async function getJawadDownload(url) {
    try {
        const api = `https://jawad-tech.vercel.app/download/ytdl?url=${encodeURIComponent(url)}`;
        const res = await axios.get(api, AXIOS_DEFAULTS);
        if (res.data?.status && res.data?.result?.mp4) return res.data.result.mp4;
        return null;
    } catch (e) {
        console.log("Jawad API Error:", e.message);
        return null;
    }
}

async function getJerryDownload(url) {
    try {
        const api = `https://jerrycoder.oggyapi.workers.dev/down/ytmp4?url=${encodeURIComponent(url)}`;
        const res = await axios.get(api, AXIOS_DEFAULTS);
        if (res.data?.status === "success" && res.data?.url) return res.data.url;
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
        if (res.data?.status === "success" && res.data?.url) return res.data.url;
        return null;
    } catch (e) {
        console.log("Jerry API 2 Error:", e.message);
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
        return await sock.sendMessage(message.chat, {
            text: "❌ Please provide a video name or YouTube link"
        }, { quoted: message });
    }

    try {
        let video;
        const isYT = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(query);

        if (isYT) {
            let videoId = '';
            try {
                const urlObj = new URL(query);
                if (urlObj.hostname === 'youtu.be') {
                    videoId = urlObj.pathname.slice(1);
                } else {
                    videoId = urlObj.searchParams.get('v');
                }
            } catch {
                videoId = query.split('/').pop().split('?')[0];
            }

            if (!videoId) {
                return sock.sendMessage(message.chat, {
                    text: "❌ Invalid YouTube link"
                }, { quoted: message });
            }

            try {
                const search = await yts(videoId);
                if (search && search.videos && search.videos.length) {
                    video = search.videos[0];
                }
            } catch (e) {}

            if (!video) {
                try {
                    const search2 = await yts(`https://www.youtube.com/watch?v=${videoId}`);
                    if (search2 && search2.videos && search2.videos.length) {
                        video = search2.videos[0];
                    }
                } catch (e) {}
            }

            if (!video) {
                video = {
                    title: 'Unknown Title',
                    url: `https://www.youtube.com/watch?v=${videoId}`,
                    thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
                    timestamp: 'N/A',
                    views: 0,
                    author: { name: 'Unknown' }
                };
            }

        } else {
            const search = await yts(query);
            if (!search.videos.length) {
                return sock.sendMessage(message.chat, {
                    text: "❌ No video results found"
                }, { quoted: message });
            }
            video = search.videos[0];
        }

        const footer = "⚡ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ";

        const captionText =
            `*${video.title}*\n\n` +
            `🎥 *CHANNEL:* ${video.author.name}\n` +
            `👁️ *VIEWS:* ${(video.views || 0).toLocaleString()}\n` +
            `⏳ *DURATION:* ${video.timestamp}\n\n` +
            `> *${footer}*`;

        await sock.sendMessage(message.chat, {
            image: { url: video.thumbnail },
            caption: captionText
        }, { quoted: message });

        await sock.sendMessage(message.chat, {
            react: { text: "⏳", key: message.key }
        });

        let downUrl = null;

        // ترتیب وار چیکنگ اور آٹو فال بیک سسٹم (اگر یو آر ایل مل جائے تو وہیں پر اگلی ٹرائے اسٹاپ ہو جائے گی)
        if (!downUrl) downUrl = await getPrinceDownload1(video.url);
        if (!downUrl) downUrl = await getPrinceDownload2(video.url);
        if (!downUrl) downUrl = await getJawadDownload(video.url);
        if (!downUrl) downUrl = await getJerryDownload(video.url);
        if (!downUrl) downUrl = await getJerryBackup(video.url);

        if (!downUrl) {
            await sock.sendMessage(message.chat, {
                react: { text: "❌", key: message.key }
            });
            return sock.sendMessage(message.chat, {
                text: "❌ All download servers are currently unavailable or timed out. Please try again later."
            }, { quoted: message });
        }

        await sock.sendMessage(message.chat, {
            react: { text: "✅", key: message.key }
        });

        await sock.sendMessage(message.chat, {
            video: { url: downUrl },
            mimetype: "video/mp4",
            caption: `*${video.title}*\n\n> *${footer}*`
        }, { quoted: message });

    } catch (err) {
        console.log("Video Command Error:", err);
        await sock.sendMessage(message.chat, {
            text: "❌ An unexpected error occurred while processing your request."
        }, { quoted: message });
    }
});
