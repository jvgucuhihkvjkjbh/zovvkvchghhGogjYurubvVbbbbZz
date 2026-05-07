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
            return reply("❌ Terabox link do");
        }

        const url = q.trim();

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
            file?.streams?.["720p"] ||
            file?.streams?.["480p"] ||
            file?.streams?.["360p"];

        if (!streamUrl) {
            return reply("❌ No playable stream found");
        }

        const quality =
            file?.streams?.["720p"]
                ? "720p"
                : file?.streams?.["480p"]
                ? "480p"
                : "360p";

        const fileName =
            file.file_name || `terabox_${Date.now()}.mp4`;

        const size =
            file.size_mb || "Unknown";

        const thumbnail =
            file.thumbnail || null;

        const caption = `🎬 *${fileName}*

📦 Size: ${size}
🎞️ Quality: ${quality}

> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡`;

        // =========================
        // THUMBNAIL
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
        // CONVERT MESSAGE
        // =========================

        await conn.sendMessage(from, {
            text: "⏳ *Converting m3u8 to mp4...*"
        }, {
            quoted: mek
        });

        // =========================
        // OUTPUT PATH FIX
        // =========================

        const outputPath = path.join(
            process.cwd(),
            `terabox_${Date.now()}.mp4`
        );

        // =========================
        // FFMPEG FIX
        // =========================

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

                .on("start", cmd => {
                    console.log("FFMPEG START:", cmd);
                })

                .on("end", () => {
                    console.log("FFMPEG DONE");
                    resolve();
                })

                .on("error", err => {
                    console.log("FFMPEG ERROR:", err);
                    reject(err);
                })

                .save(outputPath);

        });

        // =========================
        // FILE CHECK FIX
        // =========================

        if (!fs.existsSync(outputPath)) {
            return reply("❌ Converted file not found");
        }

        // =========================
        // SEND DOCUMENT
        // =========================

        await conn.sendMessage(from, {
            document: fs.createReadStream(outputPath),
            mimetype: "video/mp4",
            fileName: fileName,
            caption: caption
        }, {
            quoted: mek
        });

        // =========================
        // DELETE TEMP FILE
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
