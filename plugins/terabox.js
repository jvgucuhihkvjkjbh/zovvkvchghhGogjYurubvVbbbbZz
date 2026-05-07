const { cmd } = require('../command');
const axios = require('axios');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');

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
        // API REQUEST
        // =========================

        const response = await axios.get(
            `https://jerryproxy.vercel.app/api/download?url=${encodeURIComponent(url)}`,
            {
                timeout: 30000
            }
        );

        const data = response.data;

        if (
            !data.status ||
            !data.result ||
            !data.result.files ||
            !data.result.files.length
        ) {
            return reply("❌ Failed to fetch video");
        }

        const file = data.result.files[0];

        // =========================
        // STREAM URL
        // =========================

        const streamUrl =
            file?.streams?.["360p"] ||
            file?.streams?.["480p"] ||
            file?.streams?.["720p"];

        if (!streamUrl) {
            return reply("❌ No playable stream found");
        }

        // =========================
        // FILE INFO
        // =========================

        const fileName =
            file.file_name || `terabox_${Date.now()}.mp4`;

        const quality =
            file?.streams?.["360p"]
                ? "360p"
                : file?.streams?.["480p"]
                ? "480p"
                : "720p";

        const size =
            file.size_mb || "Unknown";

        const thumbnail =
            file.thumbnail || null;

        // =========================
        // THUMBNAIL
        // =========================

        const caption = `🎬 *${fileName}*

📦 Size: ${size}
🎞️ Quality: ${quality}

> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡`;

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
        // CONVERTING
        // =========================

        await conn.sendMessage(from, {
            text: "⏳ *Converting stream to mp4...*"
        }, {
            quoted: mek
        });

        const outputPath = path.join(
            __dirname,
            `terabox_${Date.now()}.mp4`
        );

        await new Promise((resolve, reject) => {

            ffmpeg(streamUrl)

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

        // =========================
        // SEND DOCUMENT
        // =========================

        await conn.sendMessage(from, {
            document: fs.readFileSync(outputPath),
            mimetype: "video/mp4",
            fileName: fileName,
            caption: caption
        }, {
            quoted: mek
        });

        // =========================
        // CLEAN FILE
        // =========================

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

        reply("❌ Error occurred while downloading");
    }
});
