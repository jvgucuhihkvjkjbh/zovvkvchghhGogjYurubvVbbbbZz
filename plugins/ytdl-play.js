const { cmd } = require('../command');
const axios = require('axios');
const yts = require('yt-search');

const commands = ["play", "song", "mp3"];

const getAudioUrl = async (videoUrl) => {
    try {
        const res = await axios.get(
            `https://adeel-xtech-apis.vercel.app/api/ytmp3?url=${encodeURIComponent(videoUrl)}`,
            { timeout: 35000 }
        );
        if (res.data && res.data.status && res.data.result && res.data.result.audio_download) {
            return res.data.result.audio_download;
        }
        return null;
    } catch (e) {
        console.error("Vercel API Request Error:", e.message);
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

            let vid = null;
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
                } catch (e) {
                    console.log("YTS VideoId Fetch Error:", e.message);
                }

                if (!vid) {
                    vid = {
                        title: 'YouTube Audio',
                        url: ytUrl,
                        thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
                        timestamp: 'N/A',
                        views: 0,
                        author: { name: 'YouTube' }
                    };
                }

            } else {
                try {
                    const searchResult = await yts(q);
                    if (searchResult && searchResult.videos && searchResult.videos.length > 0) {
                        vid = searchResult.videos[0];
                    }
                } catch (e) {
                    console.log("YTS Search Query Error:", e.message);
                }

                if (!vid) return reply("❌ No song results found. Try using a direct YouTube link!");
            }

            await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

            const caption =
    `*${vid.title}*\n\n` +
    `👤 *Channel:* ${vid.author?.name || 'Unknown'}\n` +
    `⏱ *Duration:* ${vid.timestamp || 'N/A'}\n` +
    `👁 *Views:* ${(vid.views || 0).toLocaleString()}\n\n` +
    `> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡*`;

            await conn.sendMessage(from, {
                image: { url: vid.thumbnail },
                caption: caption
            }, { quoted: mek });

            // Fetch audio URL from Vercel API
            const audioUrl = await getAudioUrl(vid.url);

            if (audioUrl) {
                await conn.sendMessage(from, {
                    audio: { url: audioUrl },
                    mimetype: "audio/mpeg",
                    fileName: `${vid.title}.mp3`
                }, { quoted: mek });

                await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });
            } else {
                await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
                return reply("❌ Failed to download audio from server. Please try again later.");
            }

        } catch (e) {
            console.error("Play Command Critical Error:", e);
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            reply("❌ An unexpected error occurred while processing your request.");
        }
    });
});
