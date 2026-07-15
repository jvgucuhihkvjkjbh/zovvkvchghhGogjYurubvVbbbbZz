const { cmd } = require('../command');
const axios = require('axios');
const yts = require('yt-search');

const commands = ["play", "song", "mp3"];

const downloadAudio = async (videoUrl) => {
    try {
        const res = await axios.get(
            `https://jerrycoder.oggyapi.workers.dev/down/ytmp3?url=${encodeURIComponent(videoUrl)}`,
            { timeout: 30000 }
        );

        if (res.data?.status !== "success" || !res.data?.url) {
            console.log("[play] jerrycoder API returned no valid URL:", JSON.stringify(res.data));
            return null;
        }

        const downloadUrl = res.data.url;
        const audioRes = await axios.get(downloadUrl, { responseType: "arraybuffer", timeout: 60000 });
        const buffer = Buffer.from(audioRes.data);

        if (buffer.length > 0) {
            console.log("[play] Success using API: jerrycoder");
            return buffer;
        }

        console.log("[play] jerrycoder returned empty buffer");
        return null;
    } catch (e) {
        console.log("[play] jerrycoder API failed:", e.message);
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
                } catch (e) {
                    console.log("[play] yts videoId lookup failed:", e.message);
                }

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
                try {
                    const { videos } = await yts(q);
                    if (!videos || !videos.length) {
                        return reply("❌ No song results found");
                    }
                    vid = videos[0];
                } catch (e) {
                    console.log("[play] yts search failed:", e.message);
                    await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
                    return reply("❌ Search service is currently unavailable. Please try again in a moment.");
                }
            }

            await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

            const caption =
                `*${vid.title}*\n\n` +
                `👤 *Channel:* ${vid.author.name}\n` +
                `⏱ *Duration:* ${vid.timestamp}\n` +
                `👁 *Views:* ${(vid.views || 0).toLocaleString()}\n\n` +
                `> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡*`;

            try {
                await conn.sendMessage(from, {
                    image: { url: vid.thumbnail },
                    caption: caption
                }, { quoted: mek });
            } catch (e) {
                console.log("[play] Thumbnail send failed:", e.message);
            }

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
            console.log("[play] Command Error:", e.message);
            console.log(e.stack);
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            reply("❌ An unexpected error occurred while processing your request.");
        }
    });
});
