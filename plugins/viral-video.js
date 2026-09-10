const { cmd } = require('../command');
const axios = require('axios');
const FormData = require('form-data');

cmd({
    pattern: "viralvid",
    alias: ["viralvideo", "viral", "drakerovid", "drakero"],
    desc: "Download viral videos",
    category: "download",
    react: "🔥",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("❌ Query do!\nExample: `.viralvid Dr zahra` ya `.viral all`");

        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

        const { data } = await axios.get(
            `https://adeel-xtech-apis.vercel.app/api/viral-video?q=${encodeURIComponent(q)}`,
            { timeout: 45000 }
        );

        if (!data || !data.status) {
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply("❌ Video nahi mili.");
        }

        // ========== FAST DOWNLOAD & UPLOAD SYSTEM ==========
        async function fetchVideoBuffer(videoUrl) {
            const headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36',
                'Referer': 'https://darkero.com/'
            };

            // Fast CORS Proxies & Direct Download in Parallel (Race strategy)
            const targets = [
                videoUrl,
                `https://corsproxy.io/?url=${encodeURIComponent(videoUrl)}`,
                `https://api.allorigins.win/raw?url=${encodeURIComponent(videoUrl)}`
            ];

            const fetchStream = async (url) => {
                const res = await axios.get(url, {
                    responseType: 'arraybuffer',
                    headers,
                    timeout: 20000,
                    maxContentLength: 70 * 1024 * 1024
                });
                if (res.data && res.data.byteLength > 10000) {
                    return Buffer.from(res.data);
                }
                throw new Error("Invalid video data");
            };

            // Sab se fast working link pehle pick hoga
            return await Promise.any(targets.map(url => fetchStream(url)));
        }

        async function uploadTo0x0(buffer, filename = 'viral.mp4') {
            try {
                const form = new FormData();
                form.append('file', buffer, { filename });

                const res = await axios.post('https://0x0.st', form, {
                    headers: form.getHeaders(),
                    timeout: 30000,
                    maxContentLength: Infinity,
                    maxBodyLength: Infinity
                });

                if (typeof res.data === 'string' && res.data.startsWith('http')) {
                    return res.data.trim();
                }
            } catch (e) {
                console.error("0x0.st Upload error:", e.message);
            }
            return null;
        }

        async function processAndSendVideo(videoUrl, title) {
            // 1. Direct Whatsapp URL Upload Test
            try {
                await conn.sendMessage(from, {
                    video: { url: videoUrl },
                    mimetype: 'video/mp4',
                    caption: `🎬 *${title}*`
                }, { quoted: mek });
                return true;
            } catch (e) {}

            // 2. Fast Download & Cloud Upload Fallback (0x0.st)
            try {
                const buffer = await fetchVideoBuffer(videoUrl);
                const cloudUrl = await uploadTo0x0(buffer);

                if (cloudUrl) {
                    await conn.sendMessage(from, {
                        video: { url: cloudUrl },
                        mimetype: 'video/mp4',
                        caption: `🎬 *${title}*`
                    }, { quoted: mek });
                } else {
                    // Direct Buffer Fallback
                    await conn.sendMessage(from, {
                        video: buffer,
                        mimetype: 'video/mp4',
                        caption: `🎬 *${title}*`
                    }, { quoted: mek });
                }
                return true;
            } catch (e) {
                console.error("Failed to process video:", e.message);
                return false;
            }
        }

        // ========== SINGLE VIDEO ==========
        if (data.mode === 'single') {
            const videoUrl = data.stream_url;
            if (!videoUrl) {
                await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
                return reply("❌ Video link nahi mila.");
            }

            const success = await processAndSendVideo(videoUrl, data.title);
            if (success) {
                await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });
            } else {
                await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
                reply("❌ Video download aur send karne me nakami hui.");
            }
            return;
        }

        // ========== ALL / RANDOM ==========
        if (data.mode === 'random_list' && Array.isArray(data.results)) {
            const results = data.results.slice(0, 5);

            for (let i = 0; i < results.length; i++) {
                const vid = results[i];
                if (vid.stream_url) {
                    await processAndSendVideo(vid.stream_url, vid.title);
                }

                if (i < results.length - 1) {
                    await new Promise(r => setTimeout(r, 2000));
                }
            }

            await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });
        }

    } catch (e) {
        console.error(e);
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply(`❌ Error: ${e.message || e}`);
    }
});
