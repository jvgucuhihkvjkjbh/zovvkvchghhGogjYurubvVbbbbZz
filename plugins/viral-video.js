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
            return reply("❌ *Please provide a video query or type 'all' / 'random'!*");
        }

        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

        const isAllOrRandom = ['all', 'random'].includes(q.trim().toLowerCase());
        const apiTimeout = isAllOrRandom ? 34000 : 35000;

        const apiUrl = `https://adeel-xtech-apis.vercel.app/api/viral-video?q=${encodeURIComponent(q)}`;
        
        let response;
        try {
            response = await axios.get(apiUrl, { timeout: apiTimeout });
        } catch (err) {
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply("❌ *Request timed out or server failed to respond.*");
        }

        const data = response.data;

        if (!data || !data.status) {
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply("❌ *No results found for your request.*");
        }

        // Headers required to bypass server blocking for direct .mp4 downloads
        const downloadHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Referer': 'https://darkero.com/',
            'Accept': '*/*'
        };

        // Single Video Handler
        if (data.mode === 'single' || data.stream_url || data.download_url) {
            const title = data.title || 'Viral Video';
            // ڈائریکٹ mp4 یعنی stream_url کو پہلی ترجیح دی گئی ہے
            const videoUrl = data.stream_url || data.download_url;

            if (!videoUrl) {
                await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
                return reply("❌ *Video link unavailable.*");
            }

            const caption = 
`🎬 *${title}*\n\n` +
`🔗 *Post Link:* ${data.post_url || 'N/A'}\n\n` +
`> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡*`;

            try {
                // Direct MP4 Buffer Download
                const videoRes = await axios.get(videoUrl, { 
                    responseType: 'arraybuffer',
                    headers: downloadHeaders,
                    timeout: 45000
                });
                
                const videoBuffer = Buffer.from(videoRes.data);

                await conn.sendMessage(from, {
                    video: videoBuffer,
                    mimetype: "video/mp4",
                    caption: caption
                }, { quoted: mek });
                
                await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });
            } catch (e) {
                // Backup attempt with Direct Stream URL
                try {
                    await conn.sendMessage(from, {
                        video: { url: videoUrl },
                        mimetype: "video/mp4",
                        caption: caption
                    }, { quoted: mek });
                    await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });
                } catch (errFallback) {
                    await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
                    reply("❌ *Failed to send video file.*");
                }
            }
            return;
        }

        // Multiple / Random List Handler
        if (data.mode === 'random_list' && Array.isArray(data.results)) {
            const results = data.results;

            if (!results.length) {
                await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
                return reply("❌ *No videos available.*");
            }

            let listText = `🔥 *FOUND ${results.length} VIRAL VIDEOS* 🔥\n\n`;
            results.forEach((v, index) => {
                listText += `*${index + 1}.* ${v.title}\n`;
            });
            listText += `\n> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡*`;

            await reply(listText);

            for (let i = 0; i < results.length; i++) {
                const vid = results[i];
                const videoUrl = vid.stream_url || vid.download_url;

                if (videoUrl) {
                    let sent = false;

                    try {
                        const vidRes = await axios.get(videoUrl, { 
                            responseType: 'arraybuffer',
                            headers: downloadHeaders,
                            timeout: 35000 
                        });
                        const vidBuf = Buffer.from(vidRes.data);

                        await conn.sendMessage(from, {
                            video: vidBuf,
                            mimetype: "video/mp4",
                            caption: `🎥 *[${i + 1}/${results.length}]* ${vid.title}\n\n> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡*`
                        }, { quoted: mek });
                        sent = true;
                    } catch (e) {}

                    if (!sent) {
                        try {
                            await conn.sendMessage(from, {
                                video: { url: videoUrl },
                                mimetype: "video/mp4",
                                caption: `🎥 *[${i + 1}/${results.length}]* ${vid.title}\n\n> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡*`
                            }, { quoted: mek });
                        } catch (errFallback) {}
                    }
                }
            }

            await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });
            return;
        }

    } catch (e) {
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply("❌ *An error occurred while processing your request.*");
    }
});
