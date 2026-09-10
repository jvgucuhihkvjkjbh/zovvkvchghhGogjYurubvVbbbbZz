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

        // API se response ka wait (max 45 second)
        const { data } = await axios.get(
            `https://adeel-xtech-apis.vercel.app/api/viral-video?q=${encodeURIComponent(q)}`,
            { timeout: 45000 }
        );

        if (!data || !data.status) {
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply("❌ Video nahi mili.");
        }

        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Referer': 'https://darkero.com/',
            'Accept': '*/*'
        };

        // Helper function: video download with multiple methods
        async function getVideoBuffer(videoUrl) {
            // Method 1: Direct
            try {
                const res = await axios.get(videoUrl, {
                    responseType: 'arraybuffer',
                    headers,
                    timeout: 60000,
                    maxContentLength: 70 * 1024 * 1024
                });
                return Buffer.from(res.data);
            } catch (e) {}

            // Method 2: CORS Proxy
            try {
                const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(videoUrl)}`;
                const res = await axios.get(proxyUrl, {
                    responseType: 'arraybuffer',
                    timeout: 70000,
                    maxContentLength: 70 * 1024 * 1024
                });
                return Buffer.from(res.data);
            } catch (e) {}

            // Method 3: Another proxy
            try {
                const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(videoUrl)}`;
                const res = await axios.get(proxyUrl, {
                    responseType: 'arraybuffer',
                    timeout: 70000,
                    maxContentLength: 70 * 1024 * 1024
                });
                return Buffer.from(res.data);
            } catch (e) {}

            throw new Error("All download methods failed (403/timeout)");
        }

        // ========== SINGLE VIDEO ==========
        if (data.mode === 'single') {
            const videoUrl = data.stream_url;
            if (!videoUrl) {
                await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
                return reply("❌ Video link nahi mila.");
            }

            try {
                // Pehle direct URL try
                await conn.sendMessage(from, {
                    video: { url: videoUrl },
                    mimetype: 'video/mp4',
                    caption: `🎬 *${data.title}*`
                }, { quoted: mek });
            } catch (e) {
                // Buffer + proxy se bhejo
                const buffer = await getVideoBuffer(videoUrl);
                await conn.sendMessage(from, {
                    video: buffer,
                    mimetype: 'video/mp4',
                    caption: `🎬 *${data.title}*`
                }, { quoted: mek });
            }

            await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });
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
                    await conn.sendMessage(from, {
                        video: { url: videoUrl },
                        mimetype: 'video/mp4',
                        caption: `🎥 *${vid.title}*`
                    }, { quoted: mek });
                } catch (e) {
                    try {
                        const buffer = await getVideoBuffer(videoUrl);
                        await conn.sendMessage(from, {
                            video: buffer,
                            mimetype: 'video/mp4',
                            caption: `🎥 *${vid.title}*`
                        }, { quoted: mek });
                    } catch (err) {
                        console.log(`Video ${i + 1} failed`);
                    }
                }

                // 3 second wait
                if (i < results.length - 1) {
                    await new Promise(r => setTimeout(r, 3000));
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
