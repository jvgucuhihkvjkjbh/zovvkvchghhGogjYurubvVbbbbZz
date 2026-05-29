const { cmd } = require('../command');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const ffmpeg = require('fluent-ffmpeg');

const tempFile = (ext) => path.join(os.tmpdir(), `${crypto.randomBytes(6).toString('hex')}.${ext}`);

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
            `https://jerryproxy.vercel.app/api/download?url=${encodeURIComponent(url)}`,
            { timeout: 30000, headers: { "User-Agent": "Mozilla/5.0" } }
        );

        if (!data.status || !data.result?.files?.length) return reply("❌ Failed to fetch video");

        const file = data.result.files[0];
        const streams = file?.streams || {};
        const downloadUrl = file?.download;

        if (!streams["720p"] && !streams["480p"] && !streams["360p"] && !downloadUrl)
            return reply("❌ No downloadable video found");

        const fileName = file.file_name || `terabox_${Date.now()}.mp4`;
        const totalSize = file.size_mb || "Unknown";

        const selectorCaption =
            `🎬 *${fileName}*\n\n` +
            `📦 Total Size: ${totalSize}\n\n` +
            `📊 *Select Quality:*\n` +
            `*1* → 360p\n` +
            `*2* → 480p\n` +
            `*3* → 720p _(up to ${totalSize})_\n\n` +
            `⚠️ *Reply to this thumbnail with 1, 2 or 3*\n\n` +
            `> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡`;

        let sentMsg;
        if (file.thumbnail) {
            sentMsg = await conn.sendMessage(from, {
                image: { url: file.thumbnail },
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

            const qualityMap = { "1": "360p", "2": "480p", "3": "720p" };
            const selectedQuality = qualityMap[selectedText];
            const streamUrl = streams[selectedQuality];

            const caption = `🎬 *${fileName}*\n\n📦 Size: ${totalSize}\n📥 Quality: ${selectedQuality}\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡`;

            await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

            outputPath = tempFile('mp4');
            let downloadSuccess = false;

            const activeStream = streamUrl || streams["480p"] || streams["360p"];

            if (activeStream) {
                try {
                    await new Promise((res, rej) => {
                        ffmpeg(activeStream)
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

            if (!downloadSuccess && downloadUrl) {
                const writer = fs.createWriteStream(outputPath);
                const response = await axios({
                    method: 'get',
                    url: downloadUrl,
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
            }

            if (!fs.existsSync(outputPath)) {
                await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
                return conn.sendMessage(from, { text: "❌ Download failed from all sources" }, { quoted: msg });
            }

            const stats = fs.statSync(outputPath);
            if (stats.size < 10000) {
                fs.unlinkSync(outputPath);
                await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
                return conn.sendMessage(from, { text: "❌ Invalid video file downloaded" }, { quoted: msg });
            }

            await conn.sendMessage(from, {
                document: { url: outputPath },
                mimetype: 'video/mp4',
                fileName,
                caption
            }, { quoted: msg });

            await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });

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
