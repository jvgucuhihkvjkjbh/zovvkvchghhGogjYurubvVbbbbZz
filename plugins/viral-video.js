const { cmd } = require('../command');
const axios = require('axios');

cmd({
    pattern: "viralvid",
    alias: ["viralvideo", "viral", "drakerovid", "drakero", "drakerovideo"],
    desc: "Search and download viral videos via Adeel-Xtech API",
    category: "download",
    react: "🔥",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) {
            return reply("❌ *Query do ya 'all' / 'random' likho!*\n\nExample:\n• .viralvid Dr Zahra\n• .viral all");
        }

        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

        const apiUrl = `https://adeel-xtech-apis.vercel.app/api/viral-video?q=${encodeURIComponent(q)}`;
        
        const { data } = await axios.get(apiUrl, { timeout: 30000 });

        if (!data || !data.status) {
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply("❌ *Koi video nahi mili.*");
        }

        // Common headers for darkero servers
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Referer': 'https://darkero.com/',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9'
        };

        // ========== SINGLE VIDEO ==========
        if (data.mode === 'single' || data.stream_url) {
            const title = data.title || 'Viral Video';
            const videoUrl = data.stream_url || data.download_url;

            if (!videoUrl) {
                await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
                return reply("❌ *Video link nahi mila.*");
            }

            const caption = `🎬 *${title}*\n\n🔗 ${data.post_url || ''}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡`;

            // 1st try: Direct URL (Fastest)
            try {
                await conn.sendMessage(from, {
                    video: { url: videoUrl },
                    mimetype: 'video/mp4',
                    caption: caption
                }, { quoted: mek });

                await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });
                return;
            } catch (err) {
                console.log("Direct URL failed, trying buffer...");
            }

            // 2nd try: Buffer download
            try {
                const videoRes = await axios.get(videoUrl, {
                    responseType: 'arraybuffer',
                    headers: headers,
                    timeout: 60000,
                    maxContentLength: 50 * 1024 * 1024 // 50MB max
                });

                await conn.sendMessage(from, {
                    video: Buffer.from(videoRes.data),
                    mimetype: 'video/mp4',
                    caption: caption
                }, { quoted: mek });

                await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });
            } catch (e) {
                await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
                reply("❌ *Video send nahi ho saki.*");
            }
            return;
        }

        // ========== MULTIPLE / RANDOM LIST ==========
        if (data.mode === 'random_list' && Array.isArray(data.results)) {
            const results = data.results.slice(0, 8); // max 8 videos (safety)

            if (!results.length) {
                await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
                return reply("❌ *Koi video available nahi.*");
            }

            // Pehle list bhejo
            let listText = `🔥 *${results.length} Viral Videos Found* 🔥\n\n`;
            results.forEach((v, i) => {
                listText += `*${i + 1}.* ${v.title}\n`;
            });
            listText += `\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡`;
            await reply(listText);

            // Videos one by one (direct URL pehle)
            for (let i = 0; i < results.length; i++) {
                const vid = results[i];
                const videoUrl = vid.stream_url || vid.download_url;
                if (!videoUrl) continue;

                const caption = `🎥 *[\( {i + 1}/ \){results.length}]* ${vid.title}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡`;

                try {
                    // Direct URL try
                    await conn.sendMessage(from, {
                        video: { url: videoUrl },
                        mimetype: 'video/mp4',
                        caption: caption
                    }, { quoted: mek });
                } catch (e) {
                    // Buffer fallback
                    try {
                        const res = await axios.get(videoUrl, {
                            responseType: 'arraybuffer',
                            headers: headers,
                            timeout: 45000,
                            maxContentLength: 40 * 1024 * 1024
                        });
                        await conn.sendMessage(from, {
                            video: Buffer.from(res.data),
                            mimetype: 'video/mp4',
                            caption: caption
                        }, { quoted: mek });
                    } catch (err) {
                        // skip this video
                    }
                }

                // Thoda delay taake rate-limit na aaye
                await new Promise(r => setTimeout(r, 1200));
            }

            await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });
            return;
        }

        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply("❌ *Unexpected response from API.*");

    } catch (e) {
        console.error(e);
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply("❌ *Error aa gaya. Thori der baad try karo.*");
    }
});
