const { cmd } = require('../command');
const axios = require('axios');

cmd({
    pattern: "terabox",
    alias: ["tera", "tbx", "terabox2"],
    desc: "Download Terabox video",
    category: "download",
    react: "📦",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    try {

        if (!q) {
            return reply("❌ Terabox link do\nExample: .terabox https://terabox.com/s/xxxx");
        }

        const url = q.trim();

        const validDomains = [
            "terabox.com",
            "1024terabox.com",
            "1024tera.com",
            "terasharefile.com",
            "teraboxapp.com",
            "terabox.app",
            "freeterabox.com",
            "4funbox.com",
            "mirrorbox.com",
            "mirrobox.com",
            "nephobox.com"
        ];

        const isValid = validDomains.some(domain => url.includes(domain));

        if (!isValid) {
            return reply("❌ Valid Terabox link do");
        }

        await conn.sendMessage(from, {
            react: {
                text: "⏳",
                key: mek.key
            }
        });

        // =========================
        // ONLY API 2
        // =========================

        const response = await axios.get(
            `https://jerryproxy.vercel.app/api/download?url=${encodeURIComponent(url)}`,
            {
                timeout: 30000
            }
        );

        const res = response.data;

        if (
            !res.status ||
            !res.result ||
            !res.result.files ||
            !res.result.files.length
        ) {
            return reply("❌ Download failed. Try another link.");
        }

        const file = res.result.files[0];

        const title = file.file_name || "video.mp4";
        const size = file.size_mb || "Unknown";
        const thumbnail = file.thumbnail;

        const videoUrl =
            file.download ||
            file.streams?.["720p"] ||
            file.streams?.["480p"] ||
            file.streams?.["360p"];

        if (!videoUrl) {
            return reply("❌ Video URL not found.");
        }

        const caption = `🎬 *${title}*

📦 Size: ${size}

> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡`;

        // =========================
        // Thumbnail
        // =========================

        if (thumbnail) {

            await conn.sendMessage(from, {
                image: {
                    url: thumbnail
                },
                caption: caption
            }, {
                quoted: mek
            });

        }

        // =========================
        // Send Video
        // =========================

        await conn.sendMessage(from, {
            video: {
                url: videoUrl
            },
            mimetype: "video/mp4",
            fileName: title,
            caption: caption
        }, {
            quoted: mek
        });

        await conn.sendMessage(from, {
            react: {
                text: "✅",
                key: mek.key
            }
        });

    } catch (e) {

        console.log("TERABOX ERROR:", e);

        await conn.sendMessage(from, {
            react: {
                text: "❌",
                key: mek.key
            }
        });

        reply("❌ Error occurred while downloading");
    }
});
