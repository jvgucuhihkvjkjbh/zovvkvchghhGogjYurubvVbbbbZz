const axios = require("axios");
const { cmd } = require("../command");

const API_URL = "https://jerrycoder.oggyapi.workers.dev/tool/rembg";

cmd({
    pattern: "rmbg",
    alias: ["removebg", "rbg"],
    react: '📸',
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

        if (!buffer) throw new Error("Image download failed");

        const upload = await conn.sendMessage(
            "status@broadcast",
            { image: buffer },
            { uploadOnly: true }
        );

        const imageUrl = upload?.imageMessage?.url;

        if (!imageUrl) throw new Error("Image URL not found");

        const api = `${API_URL}?url=${encodeURIComponent(imageUrl)}`;

        const response = await axios.get(api, {
            timeout: 60000
        });

        const data = response.data;

        if (data.status !== "success" || !data.result?.url) {
            throw new Error("API returned error");
        }

        const resultUrl = data.result.url;

        const resultBuffer = await axios.get(resultUrl, {
            responseType: "arraybuffer",
            timeout: 30000
        });

        const formatBytes = (bytes) => {
            if (bytes === 0) return "0 Bytes";
            const k = 1024;
            const sizes = ["Bytes", "KB", "MB"];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
        };

        const size = formatBytes(resultBuffer.data.length);

        await conn.sendMessage(m.chat, {
            react: { text: "✅", key: message.key }
        });

        await conn.sendMessage(
            m.chat,
            {
                image: Buffer.from(resultBuffer.data),
                caption: `\`REMOVE BACKGROUND\`

📦 SIZE: ${size}

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ 🍸`
            },
            { quoted: m }
        );

    } catch (err) {
        console.error("RMBG Error:", err.message);

        await conn.sendMessage(m.chat, {
            react: { text: "❌", key: message.key }
        });

        reply("❌ Background remove error, try again");
    }
});
