const { cmd } = require('../command');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const { spawn } = require('child_process');

const tempFile = (ext) => {
    return path.join(
        os.tmpdir(),
        `${crypto.randomBytes(6).toString('hex')}.${ext}`
    );
};

cmd({
    pattern: "terabox",
    alias: ["tera", "tbx"],
    desc: "Download Terabox stream",
    category: "download",
    react: "📦",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {

    let outputPath = null;

    try {

        if (!q) {
            return reply("❌ Please send a Terabox URL");
        }

        const inputUrl = q.trim();

        if (!inputUrl.startsWith("http")) {
            return reply("❌ Invalid URL");
        }

        await conn.sendMessage(from, {
            react: {
                text: "⏳",
                key: mek.key
            }
        });

        // API REQUEST
        let response;

        try {

            response = await axios.get(
                "https://jerryproxy.vercel.app/api/download",
                {
                    params: {
                        url: inputUrl
                    },
                    timeout: 60000,
                    headers: {
                        "User-Agent": "Mozilla/5.0",
                        "Referer": "https://terabox.com/"
                    }
                }
            );

        } catch (apiError) {

            console.log("API ERROR:");
            console.log(apiError?.response?.data || apiError);

            if (apiError.response) {

                return reply(
                    `❌ API Error\n\n` +
                    `Status: ${apiError.response.status}\n` +
                    `${
                        typeof apiError.response.data === "object"
                            ? JSON.stringify(apiError.response.data, null, 2)
                            : apiError.response.data
                    }`
                );
            }

            return reply(
                `❌ API Failed\n\n${apiError.message}`
            );
        }

        const data = response.data;

        console.log("API RESPONSE:");
        console.log(JSON.stringify(data, null, 2));

        if (!data.status || !data.result?.files?.length) {
            return reply("❌ Invalid API response");
        }

        const file = data.result.files[0];

        // QUALITY SELECT
        const streamUrl =
            file?.streams?.["720p"] ||
            file?.streams?.["480p"] ||
            file?.streams?.["360p"];

        if (!streamUrl) {
            return reply("❌ No playable stream found");
        }

        const quality =
            file?.streams?.["720p"]
                ? "720p"
                : file?.streams?.["480p"]
                ? "480p"
                : "360p";

        const fileName =
            file.file_name ||
            `terabox_${Date.now()}.mp4`;

        const caption =
`🎬 *${fileName}*
📥 *Quality:* ${quality}
📦 *Size:* ${file.size_mb || "Unknown"}

> ⚡ Powered By Proxy ⚡`;

        // THUMBNAIL
        if (file.thumbnail) {

            try {

                await conn.sendMessage(from, {
                    image: {
                        url: file.thumbnail
                    },
                    caption
                }, {
                    quoted: mek
                });

            } catch (thumbErr) {

                console.log("THUMB ERROR:");
                console.log(thumbErr.message);

            }
        }

        // OUTPUT FILE
        outputPath = tempFile("mp4");

        await conn.sendMessage(from, {
            text: "_Downloading & converting video..._"
        }, {
            quoted: mek
        });

        // FFMPEG SPAWN
        await new Promise((resolve, reject) => {

            const ffmpeg = spawn(ffmpegPath, [

                '-y',

                '-protocol_whitelist',
                'file,http,https,tcp,tls,crypto,data',

                '-allowed_extensions',
                'ALL',

                '-user_agent',
                'Mozilla/5.0',

                '-headers',
                'Referer: https://terabox.com/\r\n',

                '-i',
                streamUrl,

                '-map',
                '0:v?',

                '-map',
                '0:a?',

                '-c:v',
                'copy',

                '-c:a',
                'aac',

                '-bsf:a',
                'aac_adtstoasc',

                '-movflags',
                '+faststart',

                outputPath

            ], {
                timeout: 1000 * 60 * 15
            });

            let stderr = '';

            ffmpeg.stderr.on('data', (data) => {

                const text = data.toString();

                stderr += text;

                console.log("FFMPEG:", text);

            });

            ffmpeg.on('close', async (code) => {

                console.log("FFMPEG EXIT CODE:", code);

                if (code !== 0) {

                    return reject(
                        new Error(
                            stderr || `FFmpeg failed with code ${code}`
                        )
                    );
                }

                resolve();

            });

            ffmpeg.on('error', (err) => {

                console.log("SPAWN ERROR:");
                console.log(err);

                reject(err);

            });

        });

        // CHECK OUTPUT
        if (!fs.existsSync(outputPath)) {
            return reply("❌ Output file not created");
        }

        const stats = fs.statSync(outputPath);

        console.log("OUTPUT SIZE:", stats.size);

        if (stats.size < 10000) {

            fs.unlinkSync(outputPath);

            return reply("❌ Corrupted video generated");
        }

        // SEND FILE
        await conn.sendMessage(from, {
            document: fs.readFileSync(outputPath),
            mimetype: "video/mp4",
            fileName,
            caption
        }, {
            quoted: mek
        });

        // CLEANUP
        if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
        }

        await conn.sendMessage(from, {
            react: {
                text: "✅",
                key: mek.key
            }
        });

    } catch (error) {

        console.log("FINAL ERROR:");
        console.log(error);

        if (outputPath && fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
        }

        await conn.sendMessage(from, {
            react: {
                text: "❌",
                key: mek.key
            }
        });

        return reply(
            `❌ Error\n\n${error.message}`
        );
    }
});
