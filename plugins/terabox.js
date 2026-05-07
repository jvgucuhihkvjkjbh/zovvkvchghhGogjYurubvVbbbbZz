const { cmd } = require('../command');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');

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
    let tempM3u8 = null;

    try {

        if (!q) {
            return reply("❌ Please send a Terabox link");
        }

        const url = q.trim();

        await conn.sendMessage(from, {
            react: { text: "⏳", key: mek.key }
        });

        
        const api = await axios.get(
            `https://jerryproxy.vercel.app/api/download?url=${encodeURIComponent(url)}`,
            {
                timeout: 30000,
                headers: {
                    "User-Agent": "Mozilla/5.0"
                }
            }
        );

        const data = api.data;

        if (!data.status || !data.result?.files?.length) {
            return reply("❌ Invalid API response");
        }

        const file = data.result.files[0];

        
        const streamUrl =
            file.streams?.["720p"] ||
            file.streams?.["480p"] ||
            file.streams?.["360p"];

        if (!streamUrl) {
            return reply("❌ No stream URL found");
        }

        const fileName =
            file.file_name ||
            `terabox_${Date.now()}.mp4`;

        const size =
            file.size_mb || "Unknown";

        const thumbnail =
            file.thumbnail || "";

        const caption =
`🎬 *${fileName}*
📦 *Size:* ${size}
📥 *Quality:* ${
    file.streams?.["720p"] ? "720p" :
    file.streams?.["480p"] ? "480p" :
    "360p"
}

> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡`;

       
        if (thumbnail) {
            try {
                await conn.sendMessage(from, {
                    image: { url: thumbnail },
                    caption
                }, { quoted: mek });
            } catch (e) {
                console.log("Thumbnail Error:", e.message);
            }
        }

        
        outputPath = path.join(
            process.cwd(),
            `terabox_${Date.now()}.mp4`
        );

        tempM3u8 = path.join(
            process.cwd(),
            `stream_${Date.now()}.m3u8`
        );

       
        const m3u8Response = await axios.get(streamUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0",
                "Referer": "https://www.terabox.com/"
            }
        });

        fs.writeFileSync(tempM3u8, m3u8Response.data);

      
        await new Promise((resolve, reject) => {

            ffmpeg(streamUrl)
                .inputOptions([
                    '-headers',
                    'User-Agent: Mozilla/5.0\r\nReferer: https://www.terabox.com/\r\n'
                ])
                .outputOptions([
                    '-c:v copy',
                    '-c:a aac',
                    '-bsf:a aac_adtstoasc'
                ])
                .format('mp4')
                .save(outputPath)
                .on('start', cmd => {
                    console.log("FFMPEG START:", cmd);
                })
                .on('end', () => {
                    console.log("FFMPEG DONE");
                    resolve();
                })
                .on('error', err => {
                    console.log("FFMPEG ERROR:", err.message);
                    reject(err);
                });

        });

        
        if (!fs.existsSync(outputPath)) {
            return reply("❌ Conversion failed");
        }

        const stats = fs.statSync(outputPath);

        if (stats.size < 10000) {
            fs.unlinkSync(outputPath);
            return reply("❌ Corrupted video generated");
        }

        
        await conn.sendMessage(from, {
            document: fs.readFileSync(outputPath),
            mimetype: "video/mp4",
            fileName,
            caption
        }, { quoted: mek });

        
        if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
        }

        if (tempM3u8 && fs.existsSync(tempM3u8)) {
            fs.unlinkSync(tempM3u8);
        }

        await conn.sendMessage(from, {
            react: { text: "✅", key: mek.key }
        });

    } catch (e) {

        console.log("TERABOX ERROR:", e);

        if (outputPath && fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
        }

        if (tempM3u8 && fs.existsSync(tempM3u8)) {
            fs.unlinkSync(tempM3u8);
        }

        await conn.sendMessage(from, {
            react: { text: "❌", key: mek.key }
        });

        reply(`❌ Error: ${e.message}`);
    }
});
