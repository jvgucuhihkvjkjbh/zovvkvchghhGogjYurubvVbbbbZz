const { cmd } = require('../command');
const axios = require('axios');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');

cmd({
    pattern: "terabox",
    alias: ["tera", "tbx"],
    desc: "Download Terabox video fast",
    category: "download",
    react: "📦",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    try {

        if (!q) {
            return reply("❌ Terabox link do\nExample: .terabox https://terasharefile.com/s/xxxx");
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

        const isValid = validDomains.some(d => url.includes(d));

        if (!isValid) {
            return reply("❌ Valid Terabox link do");
        }

        await conn.sendMessage(from, {
            react: { text: "⏳", key: mek.key }
        });

        const res = await axios.get(
            `https://jerryproxy.vercel.app/api/download?url=${encodeURIComponent(url)}`,
            {
                timeout: 60000
            }
        );

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

        const fileName = file.file_name || `ADEEL-MD_${Date.now()}.mp4`;

        const outputPath = path.join(
            __dirname,
            `../temp/${Date.now()}.mp4`
        );

        const quality =
            file?.streams?.["720p"] ? "720p" :
            file?.streams?.["480p"] ? "480p" :
            "360p";

        const size =
            file?.size ?
            (file.size / 1024 / 1024).toFixed(2) + " MB" :
            "Unknown";

        const caption = `🎬 *${fileName}*

📦 Size: ${size}
🎞️ Quality: ${quality}

> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡`;

        if (file?.thumb) {
            await conn.sendMessage(from, {
                image: { url: file.thumb },
                caption
            }, { quoted: mek });
        }

        await conn.sendMessage(from, {
            text: "⏳ Converting video..."
        }, { quoted: mek });

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

        await conn.sendMessage(from, {
            document: fs.readFileSync(outputPath),
            mimetype: "video/mp4",
            fileName,
            caption
        }, { quoted: mek });

        if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
        }

        await conn.sendMessage(from, {
            react: { text: "✅", key: mek.key }
        });

    } catch (e) {

        console.log("TERABOX ERROR:", e);

        await conn.sendMessage(from, {
            react: { text: "❌", key: mek.key }
        });

        reply("❌ Error occurred while processing Terabox link");

    }
});
