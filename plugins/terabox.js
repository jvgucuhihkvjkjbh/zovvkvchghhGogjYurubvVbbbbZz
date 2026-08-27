const { cmd } = require('../command');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const ffmpeg = require('fluent-ffmpeg');
const { pipeline } = require('stream/promises');

const tempFile = (ext) => path.join(os.tmpdir(), `${crypto.randomBytes(6).toString('hex')}.${ext}`);

const DOWNLOAD_TIMEOUT_MS = 5 * 60 * 1000; // 5 min hard cap so nothing hangs forever

function withTimeout(promise, ms, label) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function directDownload(url, outputPath) {
    const response = await axios({
        method: 'get',
        url,
        responseType: 'stream',
        timeout: 30000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        headers: { "User-Agent": "Mozilla/5.0" }
    });
    await pipeline(response.data, fs.createWriteStream(outputPath));
}

function ffmpegDownload(streamUrl, outputPath) {
    return new Promise((resolve, reject) => {
        ffmpeg(streamUrl)
            .inputOptions([
                '-protocol_whitelist', 'file,http,https,tcp,tls,crypto',
                '-allowed_extensions', 'ALL',
                '-headers', 'User-Agent: Mozilla/5.0\r\nReferer: https://terabox.com/\r\n'
            ])
            .outputOptions([
                '-c:v copy',
                '-c:a aac',
                '-bsf:a aac_adtstoasc',
                '-movflags +faststart'
            ])
            .format('mp4')
            .on('end', resolve)
            .on('error', reject)
            .save(outputPath);
    });
}

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

        const { data } = await axios.get(
            `https://adeel-xtech-apis.vercel.app/api/terabox-dl?url=${encodeURIComponent(url)}`,
            { timeout: 30000, headers: { "User-Agent": "Mozilla/5.0" } }
        );

        if (!data.status || !data.result) return reply("❌ Failed to fetch video");

        const result = data.result;

        const streamUrl = result.stream_url || result.fast_stream_url?.["720p"] || result.fast_stream_url?.["480p"] || result.fast_stream_url?.["360p"] || result.fast_stream_360p;
        const downloadUrl = result.normal_dlink;

        if (!streamUrl && !downloadUrl) return reply("❌ No downloadable video found");

        const quality = result.quality || "Unknown";
        const fileName = result.file_name || `terabox_${Date.now()}.mp4`;
        const caption = `🎬 *${fileName}*\n\n📦 Size: ${result.size || "Unknown"}\n⏱️ Duration: ${result.duration || "Unknown"}\n📥 Quality: ${quality}\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡`;

        if (result.thumbnail) {
            try {
                await conn.sendMessage(from, { image: { url: result.thumbnail }, caption }, { quoted: mek });
            } catch {}
        }

        await reply("⏳ Downloading video, please wait...");

        outputPath = tempFile('mp4');
        let downloadSuccess = false;
        const errors = [];

        // 1) Try direct mp4 link first — fastest, lowest CPU, most reliable
        if (downloadUrl) {
            try {
                await withTimeout(directDownload(downloadUrl, outputPath), DOWNLOAD_TIMEOUT_MS, "Direct download");
                downloadSuccess = true;
            } catch (err) {
                console.error("[terabox] direct download failed:", err.response?.status || err.code || err.message);
                errors.push(`Direct: ${err.response?.status ? `HTTP ${err.response.status}` : err.message}`);
            }
        }

        // 2) Fallback to ffmpeg/m3u8 stream only if direct download failed or unavailable
        if (!downloadSuccess && streamUrl) {
            try {
                await withTimeout(ffmpegDownload(streamUrl, outputPath), DOWNLOAD_TIMEOUT_MS, "Stream download");
                downloadSuccess = true;
            } catch (err) {
                console.error("[terabox] stream download failed:", err.message);
                errors.push(`Stream: ${err.message}`);
            }
        }

        if (!downloadSuccess || !fs.existsSync(outputPath)) {
            return reply(`❌ Download failed from all sources\n\n🔍 Debug:\n${errors.join('\n') || 'No source available'}`);
        }

        const stats = fs.statSync(outputPath);
        if (stats.size < 10000) {
            fs.unlinkSync(outputPath);
            return reply(`❌ Invalid video file downloaded (size: ${stats.size} bytes — likely an error page, not a real video)`);
        }

        await conn.sendMessage(from, {
            document: { url: outputPath },
            mimetype: 'video/mp4',
            fileName,
            caption: result.thumbnail ? "" : caption
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });

    } catch (e) {
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        console.error("[terabox] fatal error:", e);
        reply(`❌ ${e.message}`);
    } finally {
        if (outputPath && fs.existsSync(outputPath)) {
            try { fs.unlinkSync(outputPath); } catch {}
        }
    }
});
