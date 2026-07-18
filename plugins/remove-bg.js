const axios = require("axios");
const { cmd } = require("../command");

const API_URL = "https://adeel-xtech-api.vercel.app/api/removebg";

cmd({
    pattern: "rmbg",
    alias: ["removebg", "rbg"],
    react: "📸",
    desc: "Remove background from image",
    category: "editing",
    filename: __filename
}, async (conn, message, m, { reply }) => {
    try {
        const quoted = message.quoted || message;
        const mime = quoted.mimetype || quoted.msg?.mimetype || "";

        if (!mime.startsWith("image/")) {
            return reply("❌ Please reply to an image");
        }

        await conn.sendMessage(m.chat, {
            react: { text: "⏳", key: message.key }
        });

        const buffer = await quoted.download();
        if (!buffer) {
            return reply("❌ Failed to download image");
        }

        const FormData = require("form-data");
        const form = new FormData();
        form.append('files[]', buffer, { filename: 'source.jpg', contentType: 'image/jpeg' });
        
        const res = await axios.post('https://uguu.se/upload.php', form, { 
            headers: form.getHeaders(),
            timeout: 30000 
        });
        
        const sourceUrl = res.data?.files?.[0]?.url;
        if (!sourceUrl) {
            return reply("❌ Failed to process image URL");
        }

        const response = await axios.get(`${API_URL}?url=${encodeURIComponent(sourceUrl)}`, { timeout: 60000 });
        const data = response.data;

        if (!data || data.status !== true || !data.result) {
            return reply("❌ Failed to remove background");
        }

        const resultImage = await axios.get(data.result, {
            responseType: "arraybuffer",
            timeout: 60000
        });
        const resultBuffer = Buffer.from(resultImage.data);

        const formatBytes = (bytes) => {
            if (bytes === 0) return "0 Bytes";
            const k = 1024;
            const sizes = ["Bytes", "KB", "MB"];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
        };

        const size = formatBytes(resultBuffer.length);

        await conn.sendMessage(m.chat, {
            react: { text: "✅", key: message.key }
        });

        await conn.sendMessage(
            m.chat,
            {
                image: resultBuffer,
                caption: `\`REMOVE BACKGROUND\`\n\n📦 SIZE: ${size}\n\n> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ 🍸*`
            },
            { quoted: m }
        );

    } catch (err) {
        console.log("RMBG Error:", err.message);
        
        await conn.sendMessage(m.chat, {
            react: { text: "❌", key: message.key }
        });

        const apiError = err.response?.data?.error || err.message;
        reply(`❌ Error: ${apiError}`);
    }
});
