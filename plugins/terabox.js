const { cmd } = require('../command');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const tempFile = (ext) => path.join(os.tmpdir(), `terabox_${crypto.randomBytes(6).toString('hex')}.${ext}`);

cmd({
    pattern: "terabox",
    alias: ["terabox-dl", "tera", "tbx"],
    desc: "Download files and videos directly from TeraBox link.",
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

        // Fetch link from your active terabox-dl API endpoint
        const { data } = await axios.get(
            `https://adeel-xtech-apis.vercel.app/api/terabox-dl?url=${encodeURIComponent(url)}`,
            { timeout: 45000, headers: { "User-Agent": "Mozilla/5.0" } }
        );

        if (!data || !data.status || !data.result) {
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply(`❌ ${data?.message || "Failed to fetch video details from TeraBox!"}`);
        }

        const result = data.result;
        const downloadUrl = result.stream_url || result.fast_stream_360p || result.fast_stream_480p || result.normal_dlink;

        if (!downloadUrl) {
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply("❌ Downloadable media link not found!");
        }

        const fileName = result.file_name || `terabox_${Date.now()}.mp4`;
        const caption = `🎬 *${fileName}*\n\n📦 *Size:* ${result.size || "Unknown"}\n⏱️ *Duration:* ${result.duration || "N/A"}\n🎥 *Quality:* ${result.quality || "HD"}\n\n> *⚡ ᴘᴏᴡᴇʀ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡*`;

        outputPath = tempFile('mp4');

        // Robust Direct Download
        const response = await axios({
            method: 'get',
            url: downloadUrl,
            responseType: 'arraybuffer',
            timeout: 180000,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "*/*",
                "Accept-Encoding": "gzip, deflate, br",
                "Connection": "keep-alive",
                "Referer": "https://www.terabox.com/"
            }
        });

        const buffer = Buffer.from(response.data);

        if (!buffer || buffer.length < 5000) {
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply("❌ Download failed or file was blocked by TeraBox!");
        }

        fs.writeFileSync(outputPath, buffer);

        // Send Direct Video Player Message
        await conn.sendMessage(from, {
            video: fs.readFileSync(outputPath),
            mimetype: 'video/mp4',
            caption: caption,
            ptv: false
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
