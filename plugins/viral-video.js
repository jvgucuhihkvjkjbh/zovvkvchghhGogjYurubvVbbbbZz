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
        if (!q) return reply("❌ Query do!\nExample: `.viralvid status` ya `.viral all`");

        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

        const { data } = await axios.get(
            `https://adeel-xtech-apis.vercel.app/api/viral-video?q=${encodeURIComponent(q)}`,
            { timeout: 45000 }
        );

        if (!data || !data.status) {
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply("❌ Video nahi mili.");
        }

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

        async function downloadVideoWithMethod(videoUrl) {
            const headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36',
                'Referer': 'https://darkero.com/',
                'Accept': '*/*',
                'Accept-Language': 'en-US,en;q=0.9'
            };

            try {
                const res = await axios.get(videoUrl, {
                    responseType: 'arraybuffer',
                    headers,
                    timeout: 25000,
                    maxContentLength: 70 * 1024 * 1024
                });
                if (res.data && res.data.byteLength > 10000) {
                    return { buffer: Buffer.from(res.data), method: "Direct Download" };
                }
            } catch (e) {}

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
                        return { buffer: Buffer.from(res.data), method: "CORS Proxy" };
                    }
                } catch (e) {}
            }

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
                            return { buffer: Buffer.from(res.data), method: "Elite Proxy" };
                        }
                    } catch (e) {}
                }
            } catch (e) {}

            throw new Error("All download methods failed");
        }

        async function processAndSend(videoUrl, title) {
            try {
                await conn.sendMessage(from, {
                    video: { url: videoUrl },
                    mimetype: 'video/mp4',
                    caption: `🎬 *${title}*\n\n📡 *Downloaded via:* Direct Link`
                }, { quoted: mek });
                return true;
            } catch (e) {}

            try {
                const { buffer, method } = await downloadVideoWithMethod(videoUrl);
                await conn.sendMessage(from, {
                    video: buffer,
                    mimetype: 'video/mp4',
                    caption: `🎬 *${title}*\n\n📡 *Downloaded via:* ${method} (Buffer)`
                }, { quoted: mek });
                return true;
            } catch (err) {
                console.error(`Failed to download ${title}:`, err.message);
                return false;
            }
        }

        if (data.mode === 'single') {
            const videoUrl = data.stream_url;
            if (!videoUrl) {
                await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
                return reply("❌ Video link nahi mila.");
            }

            const success = await processAndSend(videoUrl, data.title);
            if (success) {
                await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });
            } else {
                await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
                reply("❌ Video download aur send karne me nakami hui.");
            }
            return;
        }

        if (data.mode === 'random_list' && Array.isArray(data.results)) {
            const results = data.results;

            for (let i = 0; i < results.length; i++) {
                const vid = results[i];
                const videoUrl = vid.stream_url;
                if (!videoUrl) continue;

                await processAndSend(videoUrl, vid.title);

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
