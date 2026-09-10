const { cmd } = require('../command');
const axios = require('axios');

cmd({
    pattern: "viralvid",
    alias: ["viralvideo", "viral", "drakerovid", "drakero"],
    desc: "Search & download viral videos",
    category: "download",
    react: "🔥",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("❌ Query do!\nExample: `.viralvid Dr zahra` ya `.viral all`");

        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

        const { data } = await axios.get(`https://adeel-xtech-apis.vercel.app/api/viral-video?q=${encodeURIComponent(q)}`, {
            timeout: 90000
        });

        if (!data?.status) {
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply("❌ Video nahi mili.");
        }

        // ========== SINGLE ==========
        if (data.mode === 'single') {
            const caption = `🎬 *${data.title}*\n\n🔗 ${data.post_url || ''}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡`;

            await conn.sendMessage(from, {
                video: { url: data.stream_url },
                mimetype: 'video/mp4',
                caption
            }, { quoted: mek });

            await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });
            return;
        }

        // ========== ALL / RANDOM ==========
        if (data.mode === 'random_list' && Array.isArray(data.results)) {
            const results = data.results.slice(0, 5); // max 5

            let list = `🔥 *${results.length} Viral Videos* 🔥\n\n`;
            results.forEach((v, i) => list += `*${i + 1}.* ${v.title}\n`);
            list += `\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡`;
            await reply(list);

            for (let i = 0; i < results.length; i++) {
                const vid = results[i];
                if (!vid.stream_url) continue;

                try {
                    await conn.sendMessage(from, {
                        video: { url: vid.stream_url },
                        mimetype: 'video/mp4',
                        caption: `🎥 *[\( {i + 1}/ \){results.length}]* ${vid.title}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡`
                    }, { quoted: mek });
                    await new Promise(r => setTimeout(r, 1800));
                } catch (e) {}
            }

            await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });
        }

    } catch (e) {
        console.error(e);
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply("❌ Error aa gaya.");
    }
});
