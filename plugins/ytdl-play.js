const { cmd } = require('../command');
const axios = require('axios');
const yts = require('yt-search');

const commands = ["play", "song", "mp3"];

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

                const search = await yts({ videoId });

                if (!search || !search.title) {
                    return reply("❌ Invalid YouTube link");
                }

                vid = search;

            } else {

                const { videos } = await yts(q);
                if (!videos.length) return reply("❌ No song results found");
                vid = videos[0];
            }

            await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

            const caption = `*${vid.title}*\n\n👤 *Channel:* ${vid.author.name}\n⏱ *Duration:* ${vid.timestamp}\n👁 *Views:* ${(vid.views || 0).toLocaleString()}\n\n> ⚡ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ⚡`;

            await conn.sendMessage(from, {
                image: { url: vid.thumbnail },
                caption: caption
            }, { quoted: mek });

            let audioBuffer = null;
            let success = false;

            if (!success) {
                try {
                    const res = await axios.get(
                        `https://jerrycoder.oggyapi.workers.dev/down/ytmp3?url=${encodeURIComponent(vid.url)}`,
                        { timeout: 30000 }
                    );
                    if (res.data?.status === "success" && res.data?.url) {
                        const audioRes = await axios.get(res.data.url, { responseType: "arraybuffer", timeout: 60000 });
                        audioBuffer = Buffer.from(audioRes.data);
                        success = true;
                    }
                } catch (e) {
                    console.log("Jerry API Error:", e.message);
                }
            }

            if (!success) {
                try {
                    const res = await axios.get(
                        `https://eliteprotech-apis.zone.id/ytmp3?url=${encodeURIComponent(vid.url)}`,
                        { timeout: 30000 }
                    );
                    if (res.data?.status && res.data?.result?.download) {
                        const audioRes = await axios.get(res.data.result.download, { responseType: "arraybuffer", timeout: 60000 });
                        audioBuffer = Buffer.from(audioRes.data);
                        success = true;
                    }
                } catch (e) {
                    console.log("Elite API Error:", e.message);
                }
            }

            if (!success) {
                try {
                    const res = await axios.get(
                        `https://api.giftedtech.co.ke/api/download/ytmp3v2?apikey=gifted&url=${encodeURIComponent(vid.url)}&quality=128`,
                        { timeout: 30000 }
                    );
                    const result = res.data.result || res.data.results || res.data;
                    const url = result.download_url || result.downloadUrl || result.url || result.audio || result.link;
                    if (url) {
                        const audioRes = await axios.get(url, { responseType: "arraybuffer", timeout: 60000 });
                        audioBuffer = Buffer.from(audioRes.data);
                        success = true;
                    }
                } catch (e) {
                    console.log("Gifted API Error:", e.message);
                }
            }

            if (success && audioBuffer) {
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
