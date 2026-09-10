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
            return reply("❌ Please provide a video name OR type *'all'* / *'random'*!");
        }

        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

        const apiUrl = `https://adeel-xtech-apis.vercel.app/api/viral-video?q=${encodeURIComponent(q)}`;
        
        let response;
        try {
            response = await axios.get(apiUrl, { timeout: 45000 });
        } catch (apiErr) {
            const apiErrorMsg = apiErr.response?.data?.error || apiErr.message || "API request timed out or server down.";
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply(`❌ *API Error:* ${apiErrorMsg}`);
        }

        const data = response.data;

        if (!data || !data.status) {
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply(`❌ *Server Error:* ${data?.error || "Failed to fetch valid data from API."}`);
        }

        if (data.mode === 'single' || data.stream_url) {
            const title = data.title || 'Viral Video';
            const videoUrl = data.stream_url || data.download_url;

            if (!videoUrl) {
                await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
                return reply("❌ *Media Error:* Stream or download URL is missing from API.");
            }

            const caption = 
`🎬 *${title}*\n\n` +
`🔗 *Post URL:* ${data.post_url || 'N/A'}\n\n` +
`> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡*`;

            try {
                await conn.sendMessage(from, {
                    video: { url: videoUrl },
                    mimetype: "video/mp4",
                    caption: caption
                }, { quoted: mek });
            } catch (sendErr) {
                await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
                return reply(`❌ *WhatsApp Sending Error:* Failed to send video file.\nDetails: ${sendErr.message}`);
            }

            await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });
            return;
        }

        if (data.mode === 'random_list' && Array.isArray(data.results)) {
            const results = data.results;

            if (!results.length) {
                await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
                return reply("❌ *No Content:* API returned 0 videos for this request.");
            }

            let listText = `🔥 *Found ${results.length} Viral Videos:*\n\n`;
            results.forEach((v, index) => {
                listText += `*${index + 1}.* ${v.title}\n`;
            });
            listText += `\n> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡*`;

            await reply(listText);

            let sentCount = 0;
            let failedVideos = [];

            for (let i = 0; i < results.length; i++) {
                const vid = results[i];
                const stream = vid.stream_url || vid.download_url;

                if (stream) {
                    try {
                        await conn.sendMessage(from, {
                            video: { url: stream },
                            mimetype: "video/mp4",
                            caption: `🎥 *[${i + 1}/${results.length}]* ${vid.title}`
                        }, { quoted: mek });
                        sentCount++;
                    } catch (vidErr) {
                        failedVideos.push(`Video ${i + 1} (${vid.title}): ${vidErr.message}`);
                    }
                } else {
                    failedVideos.push(`Video ${i + 1} (${vid.title}): No valid stream URL found`);
                }
            }

            if (failedVideos.length > 0) {
                await reply(`⚠️ *Warning:* Successfully sent ${sentCount}/${results.length} videos.\n\n*Failed Details:*\n${failedVideos.join('\n')}`);
            }

            await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });
            return;
        }

    } catch (e) {
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply(`❌ *Unexpected Bot Error:*\n${e.stack || e.message || e}`);
    }
});
