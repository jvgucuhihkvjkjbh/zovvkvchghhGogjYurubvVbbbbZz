const { cmd } = require('../command');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const tempFile = (ext) => path.join(os.tmpdir(), `terabox_${crypto.randomBytes(6).toString('hex')}.${ext}`);

cmd({
    pattern: "terabox",
    alias: ["tera", "tbx", "terabox2"],
    desc: "Download Terabox video",
    category: "download",
    react: "📦",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {

    let outputPath = null;

    try {
        if (!q) return reply("❌ Please provide a valid TeraBox link!");

        const url = q.trim();
        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

        // Correct Endpoint: /api/terabox
        const { data } = await axios.get(
            `https://adeel-xtech-apis.vercel.app/api/terabox?url=${encodeURIComponent(url)}`,
            { timeout: 45000, headers: { "User-Agent": "Mozilla/5.0" } }
        );

        if (!data || !data.status || !data.result) {
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply(`❌ ${data?.message || "Failed to fetch video details from TeraBox!"}`);
        }

        const result = data.result;
        const downloadUrl = result.stream_url || result.fast_stream_360p || result.normal_dlink;

        if (!downloadUrl) {
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply("❌ Downloadable media link not found!");
        }

        const fileName = result.file_name || `terabox_${Date.now()}.mp4`;
        const caption = `🎬 *${fileName}*\n\n📦 *Size:* ${result.size || "Unknown"}\n⏱️ *Duration:* ${result.duration || "N/A"}\n🎥 *Quality:* ${result.quality || "HD"}\n\n> *⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡*`;

        // Send Thumbnail fast
        if (result.thumbnail) {
            try {
                await conn.sendMessage(from, { image: { url: result.thumbnail }, caption }, { quoted: mek });
            } catch (e) {
                console.error("Thumbnail Send Error:", e.message);
            }
        }

        outputPath = tempFile('mp4');

        // Direct Fast Stream Download to Disk
        const writer = fs.createWriteStream(outputPath);
        const response = await axios({
            method: 'get',
            url: downloadUrl,
            responseType: 'stream',
            timeout: 1200000,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                "Referer": "https://terabox.com/"
            }
        });

        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', (err) => {
                writer.close();
                reject(err);
            });
        });

        if (!fs.existsSync(outputPath)) {
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply("❌ File download failed!");
        }

        const stats = fs.statSync(outputPath);
        if (stats.size < 10000) {
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply("❌ Invalid or corrupted video file downloaded!");
        }

        // Send File as Document Stream directly from Disk
        await conn.sendMessage(from, {
            document: { url: outputPath },
            mimetype: 'video/mp4',
            fileName: fileName,
            caption: result.thumbnail ? "" : caption
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });

    } catch (e) {
        console.error("TeraBox Command Error:", e.message);
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply(`❌ Error: ${e.response?.data?.message || e.message || "Failed to process video"}`);
    } finally {
        if (outputPath && fs.existsSync(outputPath)) {
            try { fs.unlinkSync(outputPath); } catch {}
        }
    }
});
