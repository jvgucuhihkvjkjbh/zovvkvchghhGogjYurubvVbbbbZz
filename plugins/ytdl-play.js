const { cmd } = require('../command');
const axios = require('axios');
const crypto = require('crypto');
const https = require('https');

const commands = ["play", "song", "mp3"];

const TIMEOUT = 20000;
const api = {
    post: (url, data, config = {}) => axios.post(url, data, { timeout: TIMEOUT, ...config })
};

async function searchYouTube(query) {
    const url = "https://www.youtube.com/youtubei/v1/search?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW4";
    const postData = JSON.stringify({
        query: query,
        context: { client: { clientName: "WEB", clientVersion: "2.20240701.01.00" } }
    });
    const options = { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) } };
    return new Promise((resolve, reject) => {
        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject("JSON parse failed"); } });
        });
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

async function yts(options) {
    try {
        let query = typeof options === "string" ? options : options.videoId;
        const data = await searchYouTube(query);
        let videos = [];
        const sections = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || data.contents || [];
        sections.forEach(section => {
            const items = section.itemSectionRenderer?.contents || [];
            items.forEach(item => {
                const video = item.videoRenderer;
                if (video && video.videoId) videos.push(video);
            });
        });
        const formatted = videos.map(video => ({
            title: video.title?.runs?.[0]?.text || "No Title",
            videoId: video.videoId,
            url: `https://youtube.com/watch?v=${video.videoId}`,
            thumbnail: video.thumbnail?.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`,
            timestamp: video.lengthText?.simpleText || "0:00",
            author: { name: video.ownerText?.runs?.[0]?.text || "Unknown" }
        }));
        if (typeof options === "object" && options.videoId) return formatted[0] || { title: "YouTube Video", videoId: options.videoId, url: `https://youtube.com/watch?v=${options.videoId}`, thumbnail: `https://i.ytimg.com/vi/${options.videoId}/hqdefault.jpg`, timestamp: "0:00", author: { name: "Unknown" } };
        return { videos: formatted };
    } catch (e) { return { videos: [] }; }
}

const getVideoId = (url) => {
    const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|\/(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    return match ? match[1] : null;
};

const CDNS = ["cdn406.savetube.vip", "cdn405.savetube.vip", "cdn404.savetube.vip"];
const SECRET_KEY = Buffer.from("C5D58EF67A7584E4A29F6C35BBC4EB12", "hex");
const ytHeaders = {
    "content-type": "application/json",
    "origin": "https://ytube.savetube.me",
    "referer": "https://ytube.savetube.me/",
    "user-agent": "Mozilla/5.0"
};

function decryptData(enc) {
    const buf = Buffer.from(enc.replace(/\s/g, ""), "base64");
    const iv = buf.subarray(0, 16);
    const data = buf.subarray(16);
    const decipher = crypto.createDecipheriv("aes-128-cbc", SECRET_KEY, iv);
    return JSON.parse(Buffer.concat([decipher.update(data), decipher.final()]).toString());
}

const downloadAudio = async (videoUrl) => {
    const id = getVideoId(videoUrl);
    if (!id) return null;

    for (const CDN of CDNS) {
        try {
            const infoRes = await api.post(`https://${CDN}/v2/info`, { url: `https://youtube.com/watch?v=${id}` }, { headers: ytHeaders });
            const info = decryptData(infoRes.data.data);
            const dlRes = await api.post(`https://${CDN}/download`, { id: info.id, key: info.key, downloadType: "audio", quality: "192" }, { headers: ytHeaders });
            const link = dlRes.data?.data?.downloadUrl;
            if (!link) continue;
            return link;
        } catch (e) {
            continue;
        }
    }
    return null;
};

commands.forEach(pattern => {
    cmd({
        pattern: pattern,
        desc: "Download YouTube audio",
        category: "download",
        react: "🎶",
        filename: __filename
    }, async (conn, mek, m, { from, q, reply }) => {
        try {

            if (!q) {
                return reply("❌ Please provide a song name or YouTube link");
            }

            let vid;

            const isYT = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(q);

            if (isYT) {
                const videoId = getVideoId(q);
                if (!videoId) return reply("❌ Invalid YouTube link");
                vid = await yts({ videoId });
            } else {
                const searchResults = await yts(q);
                if (!searchResults.videos.length) return reply("❌ No song results found");
                vid = searchResults.videos[0];
            }

            await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

            const caption =
    `*${vid.title}*\n\n` +
    `👤 *Channel:* ${vid.author.name}\n` +
    `⏱ *Duration:* ${vid.timestamp}\n\n` +
    `> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡*`;

            await conn.sendMessage(from, {
                image: { url: vid.thumbnail },
                caption: caption
            }, { quoted: mek });

            const audioUrl = await downloadAudio(vid.url);

            if (audioUrl) {
                await conn.sendMessage(from, {
                    audio: { url: audioUrl },
                    mimetype: "audio/mpeg",
                    fileName: `${vid.title}.mp3`
                }, { quoted: mek });
                await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });
            } else {
                await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
                return reply("❌ Failed to download audio. Please try again later.");
            }

        } catch (e) {
            console.log("Play Command Error:", e);
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            reply("❌ An unexpected error occurred while processing your request.");
        }
    });
});
