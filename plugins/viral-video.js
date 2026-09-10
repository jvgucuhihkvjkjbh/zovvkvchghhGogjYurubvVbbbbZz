const { cmd } = require('../command');
const axios = require('axios');

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
            { timeout: 40000 }
        );

        if (!data || !data.status) {
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply("❌ Video nahi mili.");
        }

        // ========== FAST DOWNLOAD SYSTEM ==========
        async function downloadVideo(videoUrl) {
            const headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Referer': 'https://darkero.com/',
                'Accept': '*/*'
            };

            // Method 1: Fastest CORS (usually works)
            try {
                const res = await axios.get(`https://corsproxy.io/?url=${encodeURIComponent(videoUrl)}`, {
                    responseType: 'arraybuffer',
                    timeout: 22000,
                    maxContentLength: 70 * 1024 * 1024
                });
                if (res.data?.byteLength > 10000) return Buffer.from(res.data);
            } catch (e) {}

            // Method 2: Direct (sometimes works)
            try {
                const res = await axios.get(videoUrl, {
                    responseType: 'arraybuffer',
                    headers,
                    timeout: 18000,
                    maxContentLength: 70 * 1024 * 1024
                });
                if (res.data?.byteLength > 10000) return Buffer.from(res.data);
            } catch (e) {}

            // Method 3: Another CORS
            try {
                const res = await axios.get(`https://api.allorigins.win/raw?url=${encodeURIComponent(videoUrl)}`, {
                    responseType: 'arraybuffer',
                    timeout: 22000,
                    maxContentLength: 70 * 1024 * 1024
                });
                if (res.data?.byteLength > 10000) return Buffer.from(res.data);
            } catch (e) {}

            throw new Error("Download failed");
        }

        // ========== SINGLE VIDEO (Fast path) ==========
        if (data.mode === 'single') {
            const videoUrl = data.stream_url;
            if (!videoUrl) {
                await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
                return reply("❌ Video link nahi mila.");
            }

            try {
                // Seedha buffer download (direct URL skip kiya taake time na waste ho)
                const buffer = await downloadVideo(videoUrl);

                await conn.sendMessage(from, {
                    video: buffer,
                    mimetype: 'video/mp4',
                    caption: `🎬 *${data.title}*`
                }, { quoted: mek });

                await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });
            } catch (e) {
                await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
                reply("❌ Video download nahi ho saki.");
            }
            return;
        }

        // ========== ALL / RANDOM ==========
        if (data.mode === 'random_list' && Array.isArray(data.results)) {
            const results = data.results.slice(0, 5);

            for (let i = 0; i < results.length; i++) {
                const vid = results[i];
                const videoUrl = vid.stream_url;
                if (!videoUrl) continue;

                try {
                    // Pehle direct URL try (all mein kai baar chal jata hai)
                    await conn.sendMessage(from, {
                        video: { url: videoUrl },
                        mimetype: 'video/mp4',
                        caption: `🎥 *${vid.title}*`
                    }, { quoted: mek });
                } catch (e) {
                    try {
                        const buffer = await downloadVideo(videoUrl);
                        await conn.sendMessage(from, {
                            video: buffer,
                            mimetype: 'video/mp4',
                            caption: `🎥 *${vid.title}*`
                        }, { quoted: mek });
                    } catch (err) {}
                }

                if (i < results.length - 1) {
                    await new Promise(r => setTimeout(r, 2500));
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
