const { cmd } = require('../command');
const axios = require('axios');
const crypto = require('crypto');
const yts = require('yt-search');

const commands = ["play", "song", "mp3"];

const TIMEOUT = 20000;
const api = {
    post: (url, data, config = {}) => axios.post(url, data, { timeout: TIMEOUT, ...config })
};

const CDNS = ["cdn406.savetube.vip", "cdn405.savetube.vip", "cdn404.savetube.vip"];
const SECRET_KEY = Buffer.from("C5D58EF67A7584E4A29F6C35BBC4EB12", "hex");
const ytHeaders = {
    "content-type": "application/json",
    "origin": "https://ytube.savetube.me",
    "referer": "https://ytube.savetube.me/",
    "user-agent": "Mozilla/5.0"
};

const getVideoId = (url) => {
    const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|\/(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    return match ? match[1] : null;
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
                let videoId = '';
                try {
                    const urlObj = new URL(q);
                    if (urlObj.hostname === 'youtu.be') {
                        videoId = urlObj.pathname.slice(1);
                    } else {
                        videoId = urlObj.searchParams.get('v');
                    }
                } catch {
                    videoId = q.split('/').pop().split('?')[0];
                }

                if (!videoId) return reply("❌ Invalid YouTube link");

                const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;

                try {
                    const search = await yts({ videoId: videoId });
                    if (search && search.title) {
                        vid = {
                            title: search.title,
                            url: ytUrl,
                            thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
                            timestamp: search.duration?.timestamp || search.timestamp || 'N/A',
                            views: search.views || 0,
                            author: { name: search.author?.name || search.channel?.name || 'Unknown' }
                        };
                    }
                } catch (e) {}

                if (!vid) {
                    vid = {
                        title: 'Unknown Title',
                        url: ytUrl,
                        thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
                        timestamp: 'N/A',
                        views: 0,
                        author: { name: 'Unknown' }
                    };
                }

            } else {
                const { videos } = await yts(q);
                if (!videos.length) return reply("❌ No song results found");
                vid = videos[0];
            }

            await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

            const caption =
    `*${vid.title}*\n\n` +
    `👤 *Channel:* ${vid.author.name}\n` +
    `⏱ *Duration:* ${vid.timestamp}\n` +
    `👁 *Views:* ${(vid.views || 0).toLocaleString()}\n\n` +
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
