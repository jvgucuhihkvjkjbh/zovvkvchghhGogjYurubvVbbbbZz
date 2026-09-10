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

        // ========== SINGLE VIDEO ==========
        if (data.mode === 'single') {
            const videoUrl = data.stream_url;
            if (!videoUrl) {
                await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
                return reply("❌ Video link nahi mila.");
            }

            let sent = false;

            // Method 1: Direct URL
            try {
                await conn.sendMessage(from, {
                    video: { url: videoUrl },
                    mimetype: 'video/mp4',
                    caption: `🎬 *${data.title}*`
                }, { quoted: mek });
                sent = true;
            } catch (err1) {
                console.log("Direct URL failed:", err1.message);
            }

            // Method 2: Buffer
            if (!sent) {
                try {
                    const res = await axios.get(videoUrl, {
                        responseType: 'arraybuffer',
                        headers,
                        timeout: 70000,
                        maxContentLength: 70 * 1024 * 1024
                    });

                    await conn.sendMessage(from, {
                        video: Buffer.from(res.data),
                        mimetype: 'video/mp4',
                        caption: `🎬 *${data.title}*`
                    }, { quoted: mek });
                    sent = true;
                } catch (err2) {
                    console.log("Buffer failed:", err2.message);
                    await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
                    return reply(`❌ Video send nahi ho saki.\n\nError: ${err2.message}`);
                }
            }

            if (sent) {
                await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });
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

                let sent = false;

                try {
                    await conn.sendMessage(from, {
                        video: { url: videoUrl },
                        mimetype: 'video/mp4',
                        caption: `🎥 *${vid.title}*`
                    }, { quoted: mek });
                    sent = true;
                } catch (e) {
                    try {
                        const res = await axios.get(videoUrl, {
                            responseType: 'arraybuffer',
                            headers,
                            timeout: 55000,
                            maxContentLength: 55 * 1024 * 1024
                        });
                        await conn.sendMessage(from, {
                            video: Buffer.from(res.data),
                            mimetype: 'video/mp4',
                            caption: `🎥 *${vid.title}*`
                        }, { quoted: mek });
                        sent = true;
                    } catch (err) {
                        console.log(`Video ${i+1} failed:`, err.message);
                    }
                }

                if (i < results.length - 1) {
                    await new Promise(r => setTimeout(r, 2800));
                }
            }

            await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });
        }

    } catch (e) {
        console.error("Main Error:", e);
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply(`❌ Error aa gaya.\n\n${e.message || e}`);
    }
});
