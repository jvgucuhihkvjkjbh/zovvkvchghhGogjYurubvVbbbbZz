const { cmd } = require('../command');
const axios = require('axios');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');

cmd({
    pattern: "terabox",
    alias: ["tera", "tbx"],
    desc: "Download Terabox videos",
    category: "download",
    react: "📦",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {

    try {

        if (!q) {
            return reply("❌ Terabox link do\nExample: .terabox https://1024terabox.com/s/xxxx");
        }

        const url = q.trim();

        const validDomains = [
            "terabox.com",
            "1024terabox.com",
            "terasharefile.com",
            "teraboxapp.com",
            "terabox.app",
            "freeterabox.com",
            "4funbox.com",
            "mirrorbox.com",
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

        const response = await axios.get(
            `https://jerrycoder.oggyapi.workers.dev/turbo?url=${encodeURIComponent(url)}`,
            {
                timeout: 60000
            }
        );

        const data = response.data;

        if (!data || data.status !== "success") {
            return reply("❌ Download failed");
        }

        const videoUrl = data.download || data.stream;

        if (!videoUrl) {
            return reply("❌ Video URL not found");
        }

        const fileName = data.title || `ADEEL-MD_${Date.now()}.mp4`;

        const thumb = data.thumbnail || null;

        const sizeMB = data.size
            ? (Number(data.size) / 1024 / 1024).toFixed(2) + " MB"
            : "Unknown";

        const outputPath = path.join(
            __dirname,
            `../temp/${Date.now()}.mp4`
        );

        const caption = `🎬 *${fileName}*

📦 Size: ${sizeMB}

> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡`;

        if (thumb) {

            await conn.sendMessage(from, {
                image: {
                    url: thumb
                },
                caption
            }, {
                quoted: mek
            });

        }

        await conn.sendMessage(from, {
            text: "⏳ Converting video..."
        }, {
            quoted: mek
        });

        await new Promise((resolve, reject) => {

            ffmpeg(videoUrl)
                .inputOptions([
                    "-protocol_whitelist",
                    "file,http,https,tcp,tls,crypto",
                    "-allowed_extensions",
                    "ALL",
                    "-user_agent",
                    "Mozilla/5.0"
                ])
                .outputOptions([
                    "-c:v copy",
                    "-c:a aac",
                    "-bsf:a aac_adtstoasc",
                    "-movflags +faststart"
                ])
                .format("mp4")
                .save(outputPath)
                .on("end", resolve)
                .on("error", reject);

        });

        await conn.sendMessage(from, {
            document: fs.readFileSync(outputPath),
            mimetype: "video/mp4",
            fileName,
            caption
        }, {
            quoted: mek
        });

        if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
        }

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

        reply("❌ Error occurred while processing Terabox link");

    }
});
