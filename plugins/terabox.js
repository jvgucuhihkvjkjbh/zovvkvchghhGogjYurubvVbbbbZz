const { cmd } = require('../command');
const axios = require('axios');

const downloadTeraBox = async (teraboxUrl) => {
    try {
        const apiUrl = `https://adeel-xtech-apis.vercel.app/api/terabox-dl?url=${encodeURIComponent(teraboxUrl)}`;
        const res = await axios.get(apiUrl, { timeout: 35000 });

        if (res.data?.status && res.data?.result) {
            return res.data.result;
        }
    } catch (e) {
        console.error("TeraBox API Error:", e.message);
    }
    return null;
};

const commands = ["terabox", "tb", "tbdl"];

commands.forEach(pattern => {
    cmd({
        pattern: pattern,
        desc: "Download TeraBox file or video",
        category: "download",
        react: "📦",
        filename: __filename
    }, async (conn, mek, m, { from, q, reply }) => {
        try {
            if (!q) {
                return reply("❌ Please provide a valid TeraBox link");
            }

            const isTeraBox = /^(https?:\/\/)?(www\.)?(terabox|1024terabox|teraboxapp|terasharefile|freeterabox)\.(com|app|fun)\//i.test(q) || q.includes("terabox") || q.includes("terasharefile");

            if (!isTeraBox) {
                return reply("❌ Invalid TeraBox link!");
            }

            await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

            const fileData = await downloadTeraBox(q);

            if (!fileData) {
                await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
                return reply("❌ Failed to fetch details from TeraBox link.");
            }

            const caption =
    `📦 *TERABOX DOWNLOADER*\n\n` +
    `📁 *File:* ${fileData.file_name || 'TeraBox_File'}\n` +
    `⚖ *Size:* ${fileData.size || 'N/A'}\n` +
    `🎬 *Quality:* ${fileData.quality || 'N/A'}\n` +
    `⏱ *Duration:* ${fileData.duration || 'N/A'}\n\n` +
    `> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡*`;

            const thumbnail = fileData.thumbnail || "https://i.ibb.co/L8y2k1D/terabox.jpg";

            // 1. پہلے تھمب نیل اور ڈیٹیلز بھیجنا
            await conn.sendMessage(from, {
                image: { url: thumbnail },
                caption: caption
            }, { quoted: mek });

            const fileUrl = fileData.fast_dlink || fileData.stream_url;

            if (fileUrl) {
                const fileRes = await axios.get(fileUrl, { 
                    responseType: "arraybuffer", 
                    timeout: 120000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                    }
                });
                
                const buffer = Buffer.from(fileRes.data);

                if (buffer.length > 0) {
                    const fileName = fileData.file_name || "TeraBox_Video.mp4";

                    // 2. ڈاکومنٹ کے اندر ویڈیو سینڈ کرنا
                    await conn.sendMessage(from, {
                        document: buffer,
                        mimetype: "video/mp4",
                        fileName: fileName,
                        caption: `🎥 *${fileName}*\n\n> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡*`
                    }, { quoted: mek });

                    await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });
                } else {
                    await conn.sendMessage(from, { react: { text: "⚠️", key: mek.key } });
                    reply("❌ Download buffer was empty.");
                }
            } else {
                await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
                reply("❌ Direct download link not found.");
            }

        } catch (e) {
            console.log("TeraBox Command Error:", e);
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            reply("❌ An unexpected error occurred while processing your request.");
        }
    });
});
