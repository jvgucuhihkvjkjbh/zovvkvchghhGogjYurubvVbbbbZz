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

        // API call (45 second wait)
        const { data } = await axios.get(
            `https://adeel-xtech-apis.vercel.app/api/viral-video?q=${encodeURIComponent(q)}`,
            { timeout: 45000 }
        );

        if (!data || !data.status) {
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply("❌ Video nahi mili.");
        }

        // ========== PROXY SYSTEM (API se shift kiya) ==========
        async function getEliteProxies(limit = 5) {
            try {
                const res = await axios.get('https://api.princetechn.com/api/tools/proxy?apikey=prince', { timeout: 4000 });
                if (res.data?.success && Array.isArray(res.data.results)) {
                    return res.data.results
                        .filter(p => p.ip && p.port && p.ip !== '0.0.0.0')
                        .slice(0, limit);
                }
            } catch (e) {}
            return [];
        }

        async function downloadVideo(videoUrl) {
            const headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Referer': 'https://darkero.com/',
                'Accept': '*/*',
                'Accept-Language': 'en-US,en;q=0.9'
            };

            // 1. Direct
            try {
                const res = await axios.get(videoUrl, {
                    responseType: 'arraybuffer',
                    headers,
                    timeout: 25000,
                    maxContentLength: 70 * 1024 * 1024
                });
                return Buffer.from(res.data);
            } catch (e) {}

            // 2. CORS Proxies
            const corsList = [
                `https://corsproxy.io/?url=${encodeURIComponent(videoUrl)}`,
                `https://api.allorigins.win/raw?url=${encodeURIComponent(videoUrl)}`,
                `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(videoUrl)}`
            ];

            for (const corsUrl of corsList) {
                try {
                    const res = await axios.get(corsUrl, {
                        responseType: 'arraybuffer',
                        timeout: 30000,
                        maxContentLength: 70 * 1024 * 1024
                    });
                    if (res.data && res.data.byteLength > 10000) {
                        return Buffer.from(res.data);
                    }
                } catch (e) {}
            }

            // 3. Elite Proxies (API wala system)
            try {
                const proxies = await getEliteProxies(6);
                for (const proxy of proxies) {
                    try {
                        const res = await axios.get(videoUrl, {
                            responseType: 'arraybuffer',
                            timeout: 20000,
                            maxContentLength: 70 * 1024 * 1024,
                            proxy: {
                                protocol: 'http',
                                host: proxy.ip,
                                port: Number(proxy.port)
                            },
                            headers
                        });
                        if (res.data && res.data.byteLength > 10000) {
                            return Buffer.from(res.data);
                        }
                    } catch (e) {}
                }
            } catch (e) {}

            throw new Error("All download methods failed");
        }

        // ========== SINGLE VIDEO ==========
        if (data.mode === 'single') {
            const videoUrl = data.stream_url;
            if (!videoUrl) {
                await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
                return reply("❌ Video link nahi mila.");
            }

            try {
                // Pehle direct URL
                await conn.sendMessage(from, {
                    video: { url: videoUrl },
                    mimetype: 'video/mp4',
                    caption: `🎬 *${data.title}*`
                }, { quoted: mek });
            } catch (e) {
                // Proxy system se download
                const buffer = await downloadVideo(videoUrl);
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
                        const buffer = await downloadVideo(videoUrl);
                        await conn.sendMessage(from, {
                            video: buffer,
                            mimetype: 'video/mp4',
                            caption: `🎥 *${vid.title}*`
                        }, { quoted: mek });
                    } catch (err) {
                        console.log(`Video ${i + 1} failed`);
                    }
                }

                // 3 second gap
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
