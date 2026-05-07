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

        if (!q) return reply("❌ Please send a Terabox link");

        const url = q.trim();
        let videoData = null;
        let outputPath = null;

        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

        const tryAPI1 = async () => {
            const res = await axios.get(
                `https://jerrycoder.oggyapi.workers.dev/turbo?url=${encodeURIComponent(url)}`,
                { timeout: 25000, headers: { "User-Agent": "Mozilla/5.0" } }
            );
            const d = res.data;
            if (d.status !== "success" || !d.download) throw new Error("API 1: Invalid response");
            return {
                api: 1,
                fileName: d.title || `terabox_${Date.now()}.mp4`,
                size: d.size ? (parseInt(d.size) / (1024 * 1024)).toFixed(2) + " MB" : "Unknown",
                thumbnail: d.thumbnail || "",
                downloadUrl: d.download
            };
        };

        const tryAPI2 = async () => {
            const res = await axios.get(
                `https://jerryproxy.vercel.app/api/download?url=${encodeURIComponent(url)}`,
                { timeout: 25000, headers: { "User-Agent": "Mozilla/5.0" } }
            );
            const d = res.data;
            if (!d.status || !d.result?.files?.length) throw new Error("API 2: Invalid response");
            const file = d.result.files[0];
            if (!file.download) throw new Error("API 2: No download URL");
            return {
                api: 2,
                fileName: file.file_name || `terabox_${Date.now()}.mp4`,
                size: file.size_mb || "Unknown",
                thumbnail: file.thumbnail || "",
                downloadUrl: file.download
            };
        };

        let api1Error = null;
        let api2Error = null;

        try {
            videoData = await tryAPI1();
        } catch (e) {
            api1Error = e.message;
            console.log("API 1 failed:", api1Error);
            try {
                videoData = await tryAPI2();
            } catch (e2) {
                api2Error = e2.message;
                console.log("API 2 failed:", api2Error);
            }
        }

        if (!videoData) {
            return reply(`❌ Both APIs failed\n\n• API 1: ${api1Error}\n• API 2: ${api2Error}`);
        }

        const caption = `🎬 *${videoData.fileName}*\n📦 *Size:* ${videoData.size}\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡`;

        if (videoData.thumbnail) {
            try {
                await conn.sendMessage(from, {
                    image: { url: videoData.thumbnail },
                    caption: caption
                }, { quoted: mek });
            } catch (e) {
                console.log("Thumbnail send failed:", e.message);
            }
        }

        outputPath = path.join(process.cwd(), `terabox_${Date.now()}.mp4`);

        const downloadFile = async (downloadUrl) => {
            const writer = fs.createWriteStream(outputPath);
            const dlRes = await axios({
                method: "GET",
                url: downloadUrl,
                responseType: "stream",
                timeout: 600000,
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                    "Referer": "https://www.terabox.com/"
                }
            });
            await new Promise((resolve, reject) => {
                dlRes.data.pipe(writer);
                writer.on("finish", resolve);
                writer.on("error", reject);
            });
        };

        try {
            await downloadFile(videoData.downloadUrl);
        } catch (dlErr) {
            console.log("Download failed, retrying...", dlErr.message);
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            outputPath = path.join(process.cwd(), `terabox_${Date.now()}.mp4`);
            await downloadFile(videoData.downloadUrl);
        }

        if (!fs.existsSync(outputPath)) {
            return reply("❌ Download failed - file not created");
        }

        const fileSize = fs.statSync(outputPath).size;

        if (fileSize < 10000) {
            fs.unlinkSync(outputPath);
            return reply("❌ Downloaded file is corrupted - please try again");
        }

        await conn.sendMessage(from, {
            document: fs.readFileSync(outputPath),
            mimetype: "video/mp4",
            fileName: videoData.fileName,
            caption: caption
        }, { quoted: mek });

        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });

    } catch (e) {
        console.log("TERABOX ERROR:", e.message || e);
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply(`❌ Error: ${e.message || "Something went wrong, please try again"}`);
    }
});
