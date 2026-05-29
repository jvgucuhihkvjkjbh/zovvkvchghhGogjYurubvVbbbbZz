const { cmd } = require('../command');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const ffmpeg = require('fluent-ffmpeg');

const tempFile = (ext) => path.join(os.tmpdir(), `${crypto.randomBytes(6).toString('hex')}.${ext}`);

const formatSize = (bytes) => {
    const mb = parseInt(bytes) / (1024 * 1024);
    return mb.toFixed(2) + " MB";
};

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

        let data;
        try {
            const res = await axios.get(
                `https://jerrycoder.oggyapi.workers.dev/down/terabx?url=${encodeURIComponent(url)}`,
                { timeout: 30000, headers: { "User-Agent": "Mozilla/5.0" } }
            );
            data = res.data;
        } catch (err) {
            return reply(`❌ API request failed: ${err.message}`);
        }

        if (!data || data.status !== "success") return reply("❌ Failed to fetch video");

        const fileName = data.filename || `terabox_${Date.now()}.mp4`;
        const totalSize = data.size ? formatSize(data.size) : "Unknown";
        const normalUrl = data.download?.normal;
        const fastUrl = data.download?.fast;
        const thumbnail = data.thumbnails?.url2 || data.thumbnails?.url1 || null;

        if (!normalUrl && !fastUrl) return reply("❌ No downloadable video found");

        // Size estimate per quality
        const rawBytes = parseInt(data.size) || 0;
        const size360 = rawBytes ? formatSize(rawBytes * 0.30) : "~Low";
        const size480 = rawBytes ? formatSize(rawBytes * 0.55) : "~Medium";
        const size720 = rawBytes ? totalSize : "~Full";

        const selectorCaption =
            `🎬 *${fileName}*\n\n` +
            `📦 Total Size: ${totalSize}\n\n` +
            `📊 *Select Quality:*\n` +
            `*1* → 360p  _(~${size360})_\n` +
            `*2* → 480p  _(~${size480})_\n` +
            `*3* → 720p  _(~${size720})_\n\n` +
            `⚠️ *Reply to this thumbnail with 1, 2 or 3*\n\n` +
            `> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡`;

        let sentMsg;
        if (thumbnail) {
            sentMsg = await conn.sendMessage(from, {
                image: { url: thumbnail },
                caption: selectorCaption
            }, { quoted: mek });
        } else {
            sentMsg = await conn.sendMessage(from, {
                text: selectorCaption
            }, { quoted: mek });
        }

        const listener = async (chatUpdate) => {
            const msg = chatUpdate.messages?.[0];
            if (!msg?.message?.extendedTextMessage) return;

            const selectedText = msg.message.extendedTextMessage.text?.trim();
            const context = msg.message.extendedTextMessage.contextInfo;
            const isReplyToThumbnail = context && context.stanzaId === sentMsg.key.id;
            if (!isReplyToThumbnail) return;

            if (!["1", "2", "3"].includes(selectedText)) {
                await conn.sendMessage(from, {
                    text: "❌ Please reply with *1*, *2* or *3* only"
                }, { quoted: msg });
                return;
            }

            conn.ev.off("messages.upsert", listener);

            // ⏳ react on user's reply
            await conn.sendMessage(from, { react: { text: "⏳", key: msg.key } });

            const qualityMap = { "1": "360p", "2": "480p", "3": "720p" };
            const sizeMap = { "1": size360, "2": size480, "3": size720 };
            const selectedQuality = qualityMap[selectedText];
            const selectedSize = sizeMap[selectedText];

            // URL selection: 1=normal, 2=normal, 3=fast
            const selectedUrl = selectedText === "3" ? (fastUrl || normalUrl) : normalUrl;

            const caption = `🎬 *${fileName}*\n\n📦 Size: ~${selectedSize}\n📥 Quality: ${selectedQuality}\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡`;

            outputPath = tempFile('mp4');
            let downloadSuccess = false;

            // 720p: ffmpeg se stream karo
            if (selectedText === "3" && selectedUrl) {
                try {
                    await new Promise((res, rej) => {
                        ffmpeg(selectedUrl)
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
                            .on('end', () => {
                                downloadSuccess = true;
                                res();
                            })
                            .on('error', rej)
                            .save(outputPath);
                    });
                } catch {
                    downloadSuccess = false;
                }
            }

            // 360p / 480p: direct axios download
            if (!downloadSuccess && selectedUrl) {
                try {
                    const writer = fs.createWriteStream(outputPath);
                    const response = await axios({
                        method: 'get',
                        url: selectedUrl,
                        responseType: 'stream',
                        timeout: 1200000,
                        maxContentLength: Infinity,
                        maxBodyLength: Infinity,
                        headers: { "User-Agent": "Mozilla/5.0" }
                    });

                    response.data.pipe(writer);

                    await new Promise((res, rej) => {
                        writer.on('finish', res);
                        writer.on('error', rej);
                    });

                    downloadSuccess = true;
                } catch {
                    downloadSuccess = false;
                }
            }

            if (!fs.existsSync(outputPath) || !downloadSuccess) {
                await conn.sendMessage(from, { react: { text: "❌", key: msg.key } });
                return conn.sendMessage(from, { text: "❌ Download failed from all sources" }, { quoted: msg });
            }

            const stats = fs.statSync(outputPath);
            if (stats.size < 10000) {
                fs.unlinkSync(outputPath);
                await conn.sendMessage(from, { react: { text: "❌", key: msg.key } });
                return conn.sendMessage(from, { text: "❌ Invalid video file downloaded" }, { quoted: msg });
            }

            await conn.sendMessage(from, {
                document: { url: outputPath },
                mimetype: 'video/mp4',
                fileName,
                caption
            }, { quoted: msg });

            await conn.sendMessage(from, { react: { text: "✅", key: msg.key } });

            if (outputPath && fs.existsSync(outputPath)) {
                try { fs.unlinkSync(outputPath); } catch {}
            }
        };

        conn.ev.on("messages.upsert", listener);

        setTimeout(async () => {
            conn.ev.off("messages.upsert", listener);
            try {
                await conn.sendMessage(from, {
                    react: { text: "⏰", key: sentMsg.key }
                });
            } catch {}
        }, 60000);

    } catch (e) {
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply(`❌ ${e.message}`);
    } finally {
        if (outputPath && fs.existsSync(outputPath)) {
            try { fs.unlinkSync(outputPath); } catch {}
        }
    }
});
