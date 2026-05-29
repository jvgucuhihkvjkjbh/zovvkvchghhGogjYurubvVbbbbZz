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
async (conn, mek, m, { from, q, reply, sender }) => {

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

        const selectorCaption =
            `🎬 *${fileName}*\n` +
            `📦 Size: ${file.size_mb || "Unknown"}\n\n` +
            `📊 *Select Quality - Reply with number:*\n` +
            `*1* → 360p\n` +
            `*2* → 480p\n` +
            `*3* → 720p\n\n` +
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

        const sentMsgId = sentMsg?.key?.id;

        await new Promise((resolve) => {

            const timeout = setTimeout(async () => {
                conn.ev.off('messages.upsert', handler);
                // Timeout: صرف 
                try {
                    await conn.sendMessage(from, {
                        react: { text: "⏰", key: sentMsg.key }
                    });
                } catch {}
                resolve();
            }, 60000);

            const handler = async ({ messages }) => {
                for (const msg of messages) {
                    if (!msg.message) continue;

                    // Check: reply to our thumbnail message only
                    const quotedId = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
                    if (quotedId !== sentMsgId) continue;

                    // Check: same user who ran the command
                    const replySender = msg.key?.participant || msg.key?.remoteJid;
                    if (replySender !== sender) continue;

                    const choice = (
                        msg.message?.extendedTextMessage?.text?.trim() ||
                        msg.message?.conversation?.trim()
                    );

                    if (!["1", "2", "3"].includes(choice)) {
                        await conn.sendMessage(from, {
                            text: "❌ Please reply with *1*, *2* or *3* only"
                        }, { quoted: msg });
                        continue;
                    }

                    clearTimeout(timeout);
                    conn.ev.off('messages.upsert', handler);

                    const qualityMap = { "1": "360p", "2": "480p", "3": "720p" };
                    const selectedQuality = qualityMap[choice];
                    const streamUrl = streams[selectedQuality];

                    const caption = `🎬 *${fileName}*\n\n📦 Size: ${file.size_mb || "Unknown"}\n📥 Quality: ${selectedQuality}\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡`;

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
                        await conn.sendMessage(from, { text: "❌ Download failed from all sources" }, { quoted: msg });
                        resolve();
                        return;
                    }

                    const stats = fs.statSync(outputPath);
                    if (stats.size < 10000) {
                        fs.unlinkSync(outputPath);
                        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
                        await conn.sendMessage(from, { text: "❌ Invalid video file downloaded" }, { quoted: msg });
                        resolve();
                        return;
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

                    resolve();
                    return;
                }
            };

            conn.ev.on('messages.upsert', handler);
        });

    } catch (e) {
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply(`❌ ${e.message}`);
    } finally {
        if (outputPath && fs.existsSync(outputPath)) {
            try { fs.unlinkSync(outputPath); } catch {}
        }
    }
});
