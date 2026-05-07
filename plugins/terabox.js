const { cmd } = require('../command');
const axios = require('axios');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');

cmd({
    pattern: "terabox",
    alias: ["tera", "tbx"],
    desc: "Download Terabox video as document",
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

        const validDomains = [
            "terabox.com",
            "1024terabox.com",
            "terasharefile.com",
            "1024tera.com",
            "teraboxapp.com",
            "terabox.app",
            "4funbox.com",
            "mirrorbox.com",
            "nephobox.com",
            "freeterabox.com"
        ];

        const isValid = validDomains.some(d => url.includes(d));

        if (!isValid) {
            return reply("❌ Valid Terabox link do");
        }

        await conn.sendMessage(from, {
            react: { text: "⏳", key: mek.key }
        });

        const api = `https://jerryproxy.vercel.app/api/download?url=${encodeURIComponent(url)}`;

        const res = await axios.get(api, {
            timeout: 60000
        });

        const data = res.data;

        if (!data.status || !data.result?.files?.length) {
            return reply("❌ Download failed");
        }

        const file = data.result.files[0];

        const streamUrl =
            file?.streams?.["720p"] ||
            file?.streams?.["480p"] ||
            file?.streams?.["360p"];

        if (!streamUrl) {
            return reply("❌ Stream URL not found");
        }

        const fileName = file.file_name || `terabox_${Date.now()}.mp4`;

        const thumb =
            file.thumbnail ||
            file.raw?.file?.thumbs?.url3 ||
            file.raw?.file?.thumbs?.url2;

        const size = file.size_mb || "Unknown";

        const caption = `🎬 *${fileName}*

📦 Size: ${size}

> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡`;

        if (thumb) {
            await conn.sendMessage(from, {
                image: { url: thumb },
                caption
            }, { quoted: mek });
        }

        await reply("⏳ Converting video...");

        const outputPath = path.join(
            __dirname,
            `../temp/${Date.now()}.mp4`
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

        await reply("📤 Uploading document...");

        await conn.sendMessage(from, {
            document: fs.readFileSync(outputPath),
            mimetype: "video/mp4",
            fileName: fileName,
            caption: caption
        }, { quoted: mek });

        if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
        }

        await conn.sendMessage(from, {
            react: { text: "✅", key: mek.key }
        });

    } catch (e) {
        console.log("TERABOX ERROR:", e);

        return reply("❌ Error occurred while downloading");
    }
});
