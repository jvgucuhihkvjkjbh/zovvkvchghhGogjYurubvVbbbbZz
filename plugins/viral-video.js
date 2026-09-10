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
            return reply("❌ *Query do ya 'all' / 'random' likho!*\n\nExample:\n• .viralvid Dr zahra\n• .viral all");
        }

        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

        const apiUrl = `https://adeel-xtech-apis.vercel.app/api/viral-video?q=${encodeURIComponent(q)}`;
        const { data } = await axios.get(apiUrl, { timeout: 35000 });

        if (!data || !data.status) {
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply("❌ *Koi video nahi mili.*");
        }

        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Referer': 'https://darkero.com/',
            'Accept': '*/*',
            'Origin': 'https://darkero.com'
        };

        // ========== SINGLE VIDEO ==========
        if (data.mode === 'single' || data.stream_url) {
            const title = data.title || 'Viral Video';
            const videoUrl = data.stream_url;

            if (!videoUrl) {
                await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
                return reply("❌ *Video link nahi mila.*");
            }

            const caption = `🎬 *${title}*\n\n🔗 ${data.post_url || ''}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡`;

            try {
                // Force buffer download (most reliable)
                const videoRes = await axios.get(videoUrl, {
                    responseType: 'arraybuffer',
                    headers: headers,
                    timeout: 90000,
                    maxContentLength: 80 * 1024 * 1024
                });

                const buffer = Buffer.from(videoRes.data);

                await conn.sendMessage(from, {
                    video: buffer,
                    mimetype: 'video/mp4',
                    fileName: `${title.replace(/[^\w\s]/gi, '').slice(0, 40)}.mp4`,
                    caption: caption
                }, { quoted: mek });

                await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });
            } catch (e) {
                console.error("Single video error:", e.message);
                await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
                reply("❌ *Video download/send fail ho gaya.*\n\nError: " + (e.message || "Unknown"));
            }
            return;
        }

        // ========== RANDOM LIST (all / random) ==========
        if (data.mode === 'random_list' && Array.isArray(data.results)) {
            // Max 4 videos only (10 se crash ho jata hai)
            const results = data.results.slice(0, 4);

            if (!results.length) {
                await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
                return reply("❌ *Koi video available nahi.*");
            }

            // Pehle list bhejo
            let listText = `🔥 *${results.length} Viral Videos* 🔥\n\n`;
            results.forEach((v, i) => {
                listText += `*${i + 1}.* ${v.title}\n`;
            });
            listText += `\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡`;
            await reply(listText);

            let successCount = 0;

            for (let i = 0; i < results.length; i++) {
                const vid = results[i];
                const videoUrl = vid.stream_url;
                if (!videoUrl) continue;

                try {
                    const res = await axios.get(videoUrl, {
                        responseType: 'arraybuffer',
                        headers: headers,
                        timeout: 70000,
                        maxContentLength: 60 * 1024 * 1024
                    });

                    await conn.sendMessage(from, {
                        video: Buffer.from(res.data),
                        mimetype: 'video/mp4',
                        fileName: `viral_${i + 1}.mp4`,
                        caption: `🎥 *[\( {i + 1}/ \){results.length}]* ${vid.title}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡`
                    }, { quoted: mek });

                    successCount++;
                    
                    // Delay between videos
                    await new Promise(r => setTimeout(r, 2000));
                } catch (err) {
                    console.error(`Video ${i + 1} failed:`, err.message);
                    // continue next video
                }
            }

            if (successCount > 0) {
                await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });
            } else {
                await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
                reply("❌ *Koi bhi video send nahi ho saki.*");
            }
            return;
        }

        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply("❌ *Unexpected API response.*");

    } catch (e) {
        console.error("Main error:", e);
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply("❌ *Error aa gaya.*\n\n" + (e.message || "Unknown error"));
    }
});
