const { cmd } = require('../command');
const axios = require('axios');
const yts = require('yt-search');

const commands = ["play", "song", "mp3"];

const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Referer': 'https://www.youtube.com/'
};

const getAudioBuffer = async (videoUrl) => {
    let apiResult;
    try {
        apiResult = await axios.get(
            `https://adeel-xtech-apis.vercel.app/api/ytmp3?url=${encodeURIComponent(videoUrl)}`,
            { timeout: 30000, headers: BROWSER_HEADERS }
        );
    } catch (e) {
        console.log("Stage 1 (Vercel API call) failed:", e.message);
        return null;
    }

    if (!apiResult.data?.status || !apiResult.data.result?.audio_download) {
        console.log("Stage 1 (Vercel API call) returned invalid data:", JSON.stringify(apiResult.data));
        return null;
    }

    try {
        const audioRes = await axios.get(apiResult.data.result.audio_download, {
            responseType: "arraybuffer",
            timeout: 60000,
            headers: BROWSER_HEADERS
        });

        const buffer = Buffer.from(audioRes.data);
        if (!buffer || buffer.length < 1000) {
            console.log("Stage 2 (audio fetch) returned an empty/too small buffer, size:", buffer?.length);
            return null;
        }
        return buffer;
    } catch (e) {
        console.log("Stage 2 (audio fetch) failed:", e.message);
        return null;
    }
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

            const audioBuffer = await getAudioBuffer(vid.url);

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
            console.log("Play Command Error:", e.message);
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            reply("❌ An unexpected error occurred while processing your request.");
        }
    });
});
