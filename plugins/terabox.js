const { cmd } = require('../command');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const tempFile = (ext) =>
    path.join(
        os.tmpdir(),
        `${crypto.randomBytes(6).toString('hex')}.${ext}`
    );

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

        if (!q) {
            return reply(
                "❌ Please send a Terabox link\n\nExample:\n.terabox https://terasharefile.com/s/xxxxx"
            );
        }

        const url = q.trim();

        const validDomains = [
            'terabox.com',
            '1024terabox.com',
            'terasharefile.com',
            '1024tera.com',
            'teraboxapp.com',
            'terabox.app'
        ];

        const isValid = validDomains.some(d => url.includes(d));

        if (!isValid) {
            return reply("❌ Invalid Terabox link");
        }

        await conn.sendMessage(from, {
            react: {
                text: "⏳",
                key: mek.key
            }
        });

        const { data } = await axios.get(
            `https://jerryproxy.vercel.app/api/download?url=${encodeURIComponent(url)}`,
            {
                timeout: 30000,
                headers: {
                    "User-Agent": "Mozilla/5.0"
                }
            }
        );

        if (!data?.status || !data?.result?.files?.length) {
            return reply("❌ Failed to fetch video");
        }

        const file = data.result.files[0];

        const sizeMB = parseFloat(
            file?.size_mb?.replace(" MB", "") || "0"
        );

        let streamUrl = null;
        let quality = "360p";

        // Smart Quality Selection
        if (sizeMB <= 80 && file?.streams?.["720p"]) {
            streamUrl = file.streams["720p"];
            quality = "720p";
        } else if (sizeMB <= 250 && file?.streams?.["480p"]) {
            streamUrl = file.streams["480p"];
            quality = "480p";
        } else {
            streamUrl =
                file?.streams?.["360p"] ||
                file?.streams?.["480p"] ||
                file?.streams?.["720p"];

            quality =
                file?.streams?.["360p"] ? "360p" :
                file?.streams?.["480p"] ? "480p" :
                "720p";
        }

        if (!streamUrl) {
            return reply("❌ No playable stream found");
        }

        const fileName =
            file?.file_name ||
            `terabox_${Date.now()}.mp4`;

        const caption = `🎬 *${fileName}*

📦 Size: ${file?.size_mb || "Unknown"}
📥 Quality: ${quality}

> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡`;

        if (file?.thumbnail) {
            try {
                await conn.sendMessage(from, {
                    image: {
                        url: file.thumbnail
                    },
                    caption
                }, {
                    quoted: mek
                });
            } catch (e) {
                console.log("Thumbnail Error:", e.message);
            }
        }

        await reply("⏳ Converting video...");

        const ffmpegApi =
            `https://imjerryco-ffpeg.hf.space/?url=${encodeURIComponent(streamUrl)}`;

        const apiRes = await axios.get(ffmpegApi, {
            timeout: 120000,
            headers: {
                "User-Agent": "Mozilla/5.0"
            }
        });

        if (!apiRes?.data?.status || !apiRes?.data?.download) {
            return reply("❌ FFmpeg API failed");
        }

        const finalVideoUrl = apiRes.data.download;

        outputPath = tempFile("mp4");

        const writer = fs.createWriteStream(outputPath);

        const videoRes = await axios({
            url: finalVideoUrl,
            method: "GET",
            responseType: "stream",
            timeout: 900000,
            headers: {
                "User-Agent": "Mozilla/5.0"
            }
        });

        await new Promise((resolve, reject) => {
            videoRes.data.pipe(writer);

            writer.on("finish", resolve);
            writer.on("error", reject);
        });

        if (!fs.existsSync(outputPath)) {
            return reply("❌ Failed to process video");
        }

        const stats = fs.statSync(outputPath);

        if (stats.size < 10000) {
            fs.unlinkSync(outputPath);
            return reply("❌ Invalid video generated");
        }

        await conn.sendMessage(from, {
            document: {
                url: outputPath
            },
            mimetype: "video/mp4",
            fileName,
            caption
        }, {
            quoted: mek
        });

        await conn.sendMessage(from, {
            react: {
                text: "✅",
                key: mek.key
            }
        });

    } catch (e) {

        console.log("TERABOX ERROR:", e);

        await conn.sendMessage(from, {
            react: {
                text: "❌",
                key: mek.key
            }
        });

        reply("❌ Error occurred while downloading");

    } finally {

        if (outputPath && fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
        }

    }

});
