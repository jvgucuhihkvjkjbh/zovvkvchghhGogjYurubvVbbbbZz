const { cmd } = require('../command');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const ffmpeg = require('fluent-ffmpeg');

const tempFile = (ext) => path.join(os.tmpdir(), `${crypto.randomBytes(6).toString('hex')}.${ext}`);

const STALL_TIMEOUT_MS = 25 * 1000;   // kill only if NO new data arrives for this long
const ABSOLUTE_MAX_MS = 20 * 60 * 1000; // hard safety cap even if data keeps trickling

async function directDownload(url, outputPath) {
    const response = await axios({
        method: 'get',
        url,
        responseType: 'stream',
        timeout: 30000, // connection/initial-response timeout only
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        headers: { "User-Agent": "Mozilla/5.0" }
    });

    return new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(outputPath);
        let stallTimer;
        let absoluteTimer;
        let settled = false;

        const cleanup = () => {
            clearTimeout(stallTimer);
            clearTimeout(absoluteTimer);
        };

        const fail = (err) => {
            if (settled) return;
            settled = true;
            cleanup();
            response.data.destroy();
            writer.destroy();
            reject(err);
        };

        const resetStallTimer = () => {
            clearTimeout(stallTimer);
            stallTimer = setTimeout(() => fail(new Error("Connection stalled (no data for 25s)")), STALL_TIMEOUT_MS);
        };

        absoluteTimer = setTimeout(() => fail(new Error("Absolute max download time exceeded (20 min)")), ABSOLUTE_MAX_MS);

        resetStallTimer();

        response.data.on('data', () => resetStallTimer());
        response.data.on('error', fail);
        writer.on('error', fail);

        writer.on('finish', () => {
            if (settled) return;
            settled = true;
            cleanup();
            resolve();
        });

        response.data.pipe(writer);
    });
}

function ffmpegDownload(streamUrl, outputPath) {
    return new Promise((resolve, reject) => {
        let settled = false;
        const proc = ffmpeg(streamUrl)
            .inputOptions([
                '-protocol_whitelist', 'file,http,https,tcp,tls,crypto',
                '-allowed_extensions', 'ALL',
                '-headers', 'User-Agent: Mozilla/5.0\r\nReferer: https://terabox.com/\r\n'
            ])
            .outputOptions([
                '-c:v copy',
                '-c:a aac',
                '-bsf:a aac_adtstoasc',
                '-movflags +faststart',
                '-max_muxing_queue_size', '1024' // avoids buffer buildup that can trigger OOM/segfault
            ])
            .format('mp4')
            .on('end', () => { if (!settled) { settled = true; resolve(); } })
            .on('error', (err) => {
                if (settled) return;
                settled = true;
                if (/SIGSEGV|SIGKILL/.test(err.message)) {
                    reject(new Error("ffmpeg crashed (likely low memory on host — try upgrading dyno/VPS RAM)"));
                } else {
                    reject(err);
                }
            })
            .save(outputPath);
    });
}

async function directDownloadWithRetry(url, outputPath, attempts = 2) {
    let lastErr;
    for (let i = 0; i < attempts; i++) {
        try {
            await directDownload(url, outputPath);
            return;
        } catch (err) {
            lastErr = err;
            try { fs.existsSync(outputPath) && fs.unlinkSync(outputPath); } catch {}
        }
    }
    throw lastErr;
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
                await directDownloadWithRetry(downloadUrl, outputPath, 2);
                downloadSuccess = true;
            } catch (err) {
                console.error("[terabox] direct download failed:", err.message);
                errors.push(`Direct: ${err.message}`);
            }
        }

        // 2) Fallback to ffmpeg/m3u8 stream only if direct download failed or unavailable
        if (!downloadSuccess && streamUrl) {
            try {
                await ffmpegDownload(streamUrl, outputPath);
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
