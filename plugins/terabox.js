const { cmd } = require('../command');
const axios = require('axios');
const fs = require('fs');
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
            react: { text: "⏳", key: mek.key }
        });

        // ======================
        // API REQUEST
        // ======================

        const response = await axios.get(
            `https://jerryproxy.vercel.app/api/download?url=${encodeURIComponent(url)}`,
            { timeout: 30000 }
        );

        const data = response.data;

        if (!data.status || !data.result?.files?.length) {
            return reply("❌ Failed to fetch video info");
        }

        const file = data.result.files[0];

        // ======================
        // DIRECT DOWNLOAD URL (NO FFMPEG)
        // ======================

        const directUrl = file.download;

        if (!directUrl) {
            return reply("❌ Download URL nahi mili");
        }

        const fileName = file.file_name || `terabox_${Date.now()}.mp4`;
        const size = file.size_mb || "Unknown";
        const thumbnail = file.thumbnail || "";

        const caption = `🎬 *${fileName}*\n\n📦 Size: ${size}\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡`;

        // ======================
        // THUMBNAIL
        // ======================

        if (thumbnail) {
            try {
                await conn.sendMessage(from, {
                    image: { url: thumbnail },
                    caption: caption
                }, { quoted: mek });
            } catch (e) {
                console.log("Thumbnail error:", e.message);
            }
        }

        // ======================
        // DOWNLOADING
        // ======================

        await conn.sendMessage(from, {
            text: "⬇️ *Downloading... please wait*"
        }, { quoted: mek });

        const outputPath = path.join(
            process.cwd(),
            `terabox_${Date.now()}.mp4`
        );

        const writer = fs.createWriteStream(outputPath);

        const dlResponse = await axios({
            method: "GET",
            url: directUrl,
            responseType: "stream",
            timeout: 300000, // 5 min
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Referer": "https://www.terabox.com/"
            }
        });

        await new Promise((resolve, reject) => {
            dlResponse.data.pipe(writer);
            writer.on("finish", resolve);
            writer.on("error", reject);
        });

        // ======================
        // FILE CHECK
        // ======================

        if (!fs.existsSync(outputPath)) {
            return reply("❌ File download nahi hui");
        }

        const fileSize = fs.statSync(outputPath).size;
        console.log("File size:", fileSize);

        if (fileSize < 10000) {
            fs.unlinkSync(outputPath);
            return reply("❌ File corrupt hai — dobara try karo");
        }

        // ======================
        // SEND VIDEO
        // ======================

        await conn.sendMessage(from, {
            document: fs.readFileSync(outputPath),
            mimetype: "video/mp4",
            fileName: fileName,
            caption: caption
        }, { quoted: mek });

        // ======================
        // CLEANUP
        // ======================

        if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
        }

        await conn.sendMessage(from, {
            react: { text: "✅", key: mek.key }
        });

    } catch (e) {

        console.log("TERABOX ERROR:", e.message || e);

        await conn.sendMessage(from, {
            react: { text: "❌", key: mek.key }
        });

        reply(`❌ Error: ${e.message || "Unknown error"}`);
    }
});
