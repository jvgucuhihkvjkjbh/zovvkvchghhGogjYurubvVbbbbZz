const { cmd } = require('../command');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const tempFile = (ext) =>
    path.join(os.tmpdir(), `${crypto.randomBytes(6).toString('hex')}.${ext}`);

cmd({
    pattern: "terabox",
    alias: ["tera", "tbx", "terabox2"],
    desc: "Download Terabox video",
    category: "download",
    react: "📦",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {

    let outputPath;

    try {

        if (!q) return reply("❌ Please send a Terabox link");

        const url = q.trim();

        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

        // 1. Get Terabox info
        const { data } = await axios.get(
            `https://jerryproxy.vercel.app/api/download?url=${encodeURIComponent(url)}`,
            { timeout: 30000, headers: { "User-Agent": "Mozilla/5.0" } }
        );

        if (!data.status || !data.result?.files?.length)
            return reply("❌ Failed to fetch video");

        const file = data.result.files[0];

        // ✅ PRIORITY: 360p only (fallback 480p)
        const streamUrl =
            file?.streams?.["360p"] ||
            file?.streams?.["480p"];

        const fileName = file.file_name || `terabox_${Date.now()}.mp4`;
        const quality = file?.streams?.["360p"] ? "360p" : "480p";

        const caption = `🎬 *${fileName}*\n\n📥 Quality: ${quality}\n\n> ⚡ Powered by Adeel-MD`;

        if (file.thumbnail) {
            try {
                await conn.sendMessage(from, {
                    image: { url: file.thumbnail },
                    caption
                }, { quoted: mek });
            } catch {}
        }

        if (!streamUrl) return reply("❌ No 360p/480p stream found");

        // 2. Call HF FFmpeg API (NO LOCAL FFmpeg)
        const api = `https://imjerryco-ffpeg.hf.space/?url=${encodeURIComponent(streamUrl)}`;

        const apiRes = await axios.get(api, {
            timeout: 90000,
            headers: { "User-Agent": "Mozilla/5.0" }
        });

        if (!apiRes.data?.status || !apiRes.data?.download)
            return reply("❌ FFmpeg API failed");

        const finalVideoUrl = apiRes.data.download;

        // 3. Download processed video as STREAM (important fix)
        outputPath = tempFile("mp4");

        const writer = fs.createWriteStream(outputPath);

        const videoRes = await axios({
            url: finalVideoUrl,
            method: "GET",
            responseType: "stream",
            timeout: 900000,
            headers: { "User-Agent": "Mozilla/5.0" }
        });

        await new Promise((resolve, reject) => {
            videoRes.data.pipe(writer);
            writer.on("finish", resolve);
            writer.on("error", reject);
        });

        // 4. Validate file
        const stats = fs.statSync(outputPath);
        if (stats.size < 10000) {
            fs.unlinkSync(outputPath);
            return reply("❌ Invalid video file");
        }

        // 5. Send (IMPORTANT FIX: stream-safe send)
        await new Promise(r => setTimeout(r, 1500));

        await conn.sendMessage(from, {
            document: { url: outputPath },
            mimetype: "video/mp4",
            fileName,
            caption
        }, { quoted: mek });

        await conn.sendMessage(from, {
            react: { text: "✅", key: mek.key }
        });

    } catch (e) {
        await conn.sendMessage(from, {
            react: { text: "❌", key: mek.key }
        });
        reply(`❌ ${e.message}`);
    } finally {
        if (outputPath && fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
        }
    }
});
