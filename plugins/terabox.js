const { cmd } = require('../command');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');

cmd({
    pattern: "terabox",
    alias: ["tera", "tbx"],
    desc: "Download Terabox stream as mp4",
    category: "download",
    react: "📦",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {

    let outputPath;

    try {

        if (!q) {
            return reply("❌ Please send a Terabox link");
        }

        await conn.sendMessage(from, {
            react: {
                text: "⏳",
                key: mek.key
            }
        });

        
        let response;

        try {

            response = await axios.get(
                `https://jerryproxy.vercel.app/api/download?url=${encodeURIComponent(q)}`,
                {
                    timeout: 30000,
                    headers: {
                        "User-Agent": "Mozilla/5.0"
                    }
                }
            );

        } catch (apiError) {

            console.log("API ERROR:", apiError);

            if (apiError.response) {

                return reply(
                    `❌ API Error\n\n` +
                    `Status: ${apiError.response.status}\n` +
                    `Response:\n${
                        typeof apiError.response.data === "object"
                            ? JSON.stringify(apiError.response.data, null, 2)
                            : apiError.response.data
                    }`
                );
            }

            if (apiError.code === "ECONNABORTED") {
                return reply("❌ API request timeout");
            }

            return reply(`❌ API Failed\n\n${apiError.message}`);
        }

        const data = response.data;

        console.log("FULL API RESPONSE:");
        console.log(JSON.stringify(data, null, 2));

        if (!data.status || !data.result?.files?.length) {
            return reply(
                `❌ Invalid API Response\n\n${JSON.stringify(data, null, 2)}`
            );
        }

        const file = data.result.files[0];

        
        const streamUrl =
            file?.streams?.["720p"] ||
            file?.streams?.["480p"] ||
            file?.streams?.["360p"];

        if (!streamUrl) {
            return reply(
                `❌ No stream URL found\n\n${JSON.stringify(file, null, 2)}`
            );
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

> ⚡ Powered By  Proxy ⚡`;

        
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

            } catch (thumbError) {

                console.log("THUMB ERROR:", thumbError.message);

            }
        }

        
        outputPath = path.join(
            process.cwd(),
            `terabox_${Date.now()}.mp4`
        );

        await conn.sendMessage(from, {
            text: "_Converting stream to mp4..._"
        }, {
            quoted: mek
        });

        
        try {

            await axios.get(streamUrl, {
                timeout: 15000,
                headers: {
                    "User-Agent": "Mozilla/5.0",
                    "Referer": "https://www.terabox.com/"
                }
            });

            console.log("STREAM ACCESS SUCCESS");

        } catch (streamError) {

            console.log("STREAM ERROR:", streamError);

            return reply(
                `❌ Stream Error\n\n` +
                `Status: ${streamError?.response?.status || "Unknown"}\n` +
                `Message: ${streamError.message}`
            );
        }

        
        await new Promise((resolve, reject) => {

            ffmpeg(streamUrl)

                .inputOptions([
                    "-protocol_whitelist",
                    "file,http,https,tcp,tls,crypto",
                    "-allowed_extensions",
                    "ALL",
                    "-reconnect",
                    "1",
                    "-reconnect_streamed",
                    "1",
                    "-reconnect_delay_max",
                    "5",
                    "-user_agent",
                    "Mozilla/5.0"
                ])

                .outputOptions([
                    "-c:v",
                    "copy",
                    "-c:a",
                    "aac",
                    "-bsf:a",
                    "aac_adtstoasc",
                    "-movflags",
                    "+faststart"
                ])

                .format("mp4")

                .save(outputPath)

                .on("start", commandLine => {

                    console.log("FFMPEG COMMAND:");
                    console.log(commandLine);

                })

                .on("stderr", stderrLine => {

                    console.log("FFMPEG STDERR:");
                    console.log(stderrLine);

                })

                .on("end", () => {

                    console.log("FFMPEG FINISHED");
                    resolve();

                })

                .on("error", err => {

                    console.log("FFMPEG FULL ERROR:");
                    console.log(err);

                    reject(
                        new Error(
                            err.message ||
                            "Unknown ffmpeg conversion error"
                        )
                    );

                });

        });

       
        if (!fs.existsSync(outputPath)) {
            return reply("❌ Output file not generated");
        }

        const stats = fs.statSync(outputPath);

        console.log("OUTPUT SIZE:", stats.size);

        if (stats.size < 10000) {

            fs.unlinkSync(outputPath);

            return reply(
                `❌ Corrupted video generated\n\nSize: ${stats.size} bytes`
            );
        }

       
        await conn.sendMessage(from, {
            document: fs.readFileSync(outputPath),
            mimetype: "video/mp4",
            fileName,
            caption
        }, {
            quoted: mek
        });

        
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
            `❌ Error Details\n\n` +
            `Name: ${error.name}\n` +
            `Message: ${error.message}\n\n` +
            `Check terminal for full logs`
        );
    }
});
