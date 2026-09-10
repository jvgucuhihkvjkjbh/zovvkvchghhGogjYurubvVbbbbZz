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
        const { data } = await axios.get(apiUrl, { timeout: 35000 });

        if (!data || !data.status) {
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply("❌ Failed to fetch video from server. Please try again later.");
        }

        if (data.mode === 'single' || data.stream_url) {
            const title = data.title || 'Viral Video';
            const thumbnail = data.thumbnail;
            const videoUrl = data.stream_url || data.download_url;

            const caption = 
`🎬 *${title}*\n\n` +
`🔗 *Post URL:* ${data.post_url || 'N/A'}\n\n` +
`> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡*`;

            if (thumbnail) {
                await conn.sendMessage(from, {
                    image: { url: thumbnail },
                    caption: caption
                }, { quoted: mek });
            }

            if (videoUrl) {
                await conn.sendMessage(from, {
                    video: { url: videoUrl },
                    mimetype: "video/mp4",
                    caption: `📥 *Downloaded:* ${title}`
                }, { quoted: mek });
            }

            await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });
            return;
        }

        if (data.mode === 'random_list' && Array.isArray(data.results)) {
            const results = data.results;

            if (!results.length) {
                await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
                return reply("❌ No videos found.");
            }

            let listText = `🔥 *Found ${results.length} Viral Videos:*\n\n`;
            results.forEach((v, index) => {
                listText += `*${index + 1}.* ${v.title}\n`;
            });
            listText += `\n> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡*`;

            await reply(listText);

            for (let i = 0; i < results.length; i++) {
                const vid = results[i];
                const stream = vid.stream_url || vid.download_url;

                if (stream) {
                    await conn.sendMessage(from, {
                        video: { url: stream },
                        mimetype: "video/mp4",
                        caption: `🎥 *[${i + 1}/${results.length}]* ${vid.title}`
                    }, { quoted: mek });
                }
            }

            await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });
            return;
        }

    } catch (e) {
        console.error("Viral Video Command Error:", e.message);
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply("❌ An unexpected error occurred while processing your request.");
    }
});
