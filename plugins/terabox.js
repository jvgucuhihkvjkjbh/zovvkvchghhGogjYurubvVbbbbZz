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
        // GET BEST STREAM URL
        // ======================

        const streams = file?.streams || {};
        const streamUrl =
            streams["720p"] ||
            streams["480p"] ||
            streams["360p"] ||
            file.download;

        const directDownload = file.download;

        if (!streamUrl && !directDownload) {
            return reply("❌ No download URL found");
        }

        const quality =
            streams["720p"] ? "720p" :
            streams["480p"] ? "480p" :
            streams["360p"] ? "360p" : "Original";

        const fileName = file.file_name || `terabox_${Date.now()}.mp4`;
        const size = file.size_mb || "Unknown";
        const thumbnail = file.thumbnail || "";

        const caption = `🎬 *${fileName}*\n\n📦 Size: ${size}\n🎞️ Quality: ${quality}\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡`;

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
                console.log("Thumbnail send failed:", e.message);
            }
        }

        // ======================
        // DOWNLOAD VIDEO
        // ======================

        await conn.sendMessage(from, {
            text: "⬇️ *Downloading Video...*"
        }, { quoted: mek });

        const outputPath = path.join(process.cwd(), `terabox_${Date.now()}.mp4`);

        // If stream is HLS (.m3u8), convert with ffmpeg
        // If direct download link, download with axios (faster)

        if (streamUrl && streamUrl.includes(".m3u8")) {

            await new Promise((resolve, reject) => {
                ffmpeg(streamUrl)
                    .inputOptions([
                        "-protocol_whitelist", "file,http,https,tcp,tls,crypto",
                        "-allowed_extensions", "ALL"
                    ])
                    .outputOptions([
                        "-c copy",
                        "-bsf:a", "aac_adtstoasc"
                    ])
                    .format("mp4")
                    .on("start", (cmd) => console.log("FFmpeg started:", cmd))
                    .on("progress", (p) => console.log("Progress:", p.percent + "%"))
                    .on("end", () => {
                        console.log("FFmpeg done");
                        resolve();
                    })
                    .on("error", (err) => {
                        console.log("FFMPEG ERROR:", err.message);
                        reject(err);
                    })
                    .save(outputPath);
            });

        } else {

            // Direct download with axios (for non-HLS)
            const writer = fs.createWriteStream(outputPath);
            const dlResponse = await axios({
                method: "GET",
                url: directDownload || streamUrl,
                responseType: "stream",
                timeout: 120000,
                headers: {
                    "User-Agent": "Mozilla/5.0"
                }
            });

            await new Promise((resolve, reject) => {
                dlResponse.data.pipe(writer);
                writer.on("finish", resolve);
                writer.on("error", reject);
            });

        }

        // ======================
        // CHECK FILE EXISTS
        // ======================

        if (!fs.existsSync(outputPath)) {
            return reply("❌ Download failed — file not created");
        }

        const fileStat = fs.statSync(outputPath);
        console.log("Downloaded file size:", fileStat.size, "bytes");

        if (fileStat.size < 10000) {
            fs.unlinkSync(outputPath);
            return reply("❌ Downloaded file is too small — something went wrong");
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
