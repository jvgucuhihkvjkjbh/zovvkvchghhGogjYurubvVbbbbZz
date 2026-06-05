const { cmd } = require('../command');
const axios = require('axios');
const yts = require('yt-search');

const commands = ["play", "song", "mp3"];

// ── Queue system
const queue = new Map();

const addToQueue = (userId, task) => {
    if (!queue.has(userId)) queue.set(userId, Promise.resolve());
    const current = queue.get(userId);
    const next = current.then(() => task());
    queue.set(userId, next.catch(() => {}));
    return next;
};

const downloadAudio = async (videoUrl) => {
    const apis = [
        async () => {
            const res = await axios.get(
                `https://api.princetechn.com/api/download/ytmp3?apikey=prince&url=${encodeURIComponent(videoUrl)}`,
                { timeout: 30000 }
            );
            const url = res.data?.result?.download_url;
            if (!url) throw new Error("No URL");
            const audioRes = await axios.get(url, { responseType: "arraybuffer", timeout: 60000 });
            const buffer = Buffer.from(audioRes.data);
            if (buffer.length < 50000) throw new Error("File too small");
            return buffer;
        },
        async () => {
            const res = await axios.get(
                `https://jerrycoder.oggyapi.workers.dev/down/ytmp3?url=${encodeURIComponent(videoUrl)}`,
                { timeout: 30000 }
            );
            const url = res.data?.url;
            if (res.data?.status !== "success" || !url) throw new Error("No URL");
            const audioRes = await axios.get(url, { responseType: "arraybuffer", timeout: 60000 });
            const buffer = Buffer.from(audioRes.data);
            if (buffer.length < 50000) throw new Error("File too small");
            return buffer;
        },
        async () => {
            const res = await axios.get(
                `https://eliteprotech-apis.zone.id/ytmp3?url=${encodeURIComponent(videoUrl)}`,
                { timeout: 30000 }
            );
            const url = res.data?.result?.download;
            if (!url) throw new Error("No URL");
            const audioRes = await axios.get(url, { responseType: "arraybuffer", timeout: 60000 });
            const buffer = Buffer.from(audioRes.data);
            if (buffer.length < 50000) throw new Error("File too small");
            return buffer;
        },
        async () => {
            const res = await axios.get(
                `https://api.giftedtech.co.ke/api/download/ytmp3v2?apikey=gifted&url=${encodeURIComponent(videoUrl)}&quality=128`,
                { timeout: 30000 }
            );
            const result = res.data.result || res.data.results || res.data;
            const url = result.download_url || result.downloadUrl || result.url || result.audio || result.link;
            if (!url) throw new Error("No URL");
            const audioRes = await axios.get(url, { responseType: "arraybuffer", timeout: 60000 });
            const buffer = Buffer.from(audioRes.data);
            if (buffer.length < 50000) throw new Error("File too small");
            return buffer;
        }
    ];

    for (let i = 0; i < apis.length; i++) {
        try {
            const buffer = await apis[i]();
            return buffer;
        } catch (e) {
            console.log(`API ${i + 1} failed: ${e.message}`);
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

        const userId = m.sender || from;

        addToQueue(userId, async () => {
            try {
                if (!q) return reply("❌ Please provide a song name or YouTube link");

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

                const audioBuffer = await downloadAudio(vid.url);

                if (audioBuffer) {
                    await conn.sendMessage(from, {
                        audio: audioBuffer,
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
});
