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

        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Referer': 'https://darkero.com/',
            'Accept': '*/*'
        };

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
                // Fail hone pe buffer se bhejo
                const res = await axios.get(videoUrl, {
                    responseType: 'arraybuffer',
                    headers,
                    timeout: 60000,
                    maxContentLength: 60 * 1024 * 1024
                });
                await conn.sendMessage(from, {
                    video: Buffer.from(res.data),
                    mimetype: 'video/mp4',
                    caption: `🎬 *${data.title}*`
                }, { quoted: mek });
            }

            await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });
            return;
        }

        // ========== ALL / RANDOM ==========
        if (data.mode === 'random_list' && Array.isArray(data.results)) {
            const results = data.results.slice(0, 6); // max 6 videos

            for (let i = 0; i < results.length; i++) {
                const vid = results[i];
                const videoUrl = vid.stream_url;
                if (!videoUrl) continue;

                try {
                    // Direct URL
                    await conn.sendMessage(from, {
                        video: { url: videoUrl },
                        mimetype: 'video/mp4',
                        caption: `🎥 *${vid.title}*`
                    }, { quoted: mek });
                } catch (e) {
                    try {
                        // Buffer fallback
                        const res = await axios.get(videoUrl, {
                            responseType: 'arraybuffer',
                            headers,
                            timeout: 50000,
                            maxContentLength: 50 * 1024 * 1024
                        });
                        await conn.sendMessage(from, {
                            video: Buffer.from(res.data),
                            mimetype: 'video/mp4',
                            caption: `🎥 *${vid.title}*`
                        }, { quoted: mek });
                    } catch (err) {
                        // skip this video
                    }
                }

                // 2.5 second wait before next video
                if (i < results.length - 1) {
                    await new Promise(r => setTimeout(r, 2500));
                }
            }

            await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });
        }

    } catch (e) {
        console.error(e);
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply("❌ Error aa gaya.");
    }
});
