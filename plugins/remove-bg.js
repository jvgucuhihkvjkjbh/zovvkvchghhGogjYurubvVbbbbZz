const axios = require("axios");
const FormData = require("form-data");
const { cmd } = require("../command");

const API_URL = "https://adeel-xtech-api.vercel.app/api/removebg";

async function uploadImage(buffer) {
    try {
        const form = new FormData();
        form.append("file", buffer, "image.jpg");

        const res = await axios.post("https://tmpfiles.org/api/v1/upload", form, {
            headers: form.getHeaders(),
            timeout: 60000
        });

        if (!res.data?.data?.url) return null;

        return res.data.data.url.replace(
            "https://tmpfiles.org/",
            "https://tmpfiles.org/dl/"
        );

    } catch (e) {
        return null;
    }
}

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

        const uploadedUrl = await uploadImage(buffer);

        if (!uploadedUrl) {
            return reply("❌ Image upload failed");
        }

        const api = `${API_URL}?url=${encodeURIComponent(uploadedUrl)}`;
        const response = await axios.get(api, { timeout: 60000 });
        const data = response.data;

        if (!data.success || !data.result?.success || !data.result?.base64) {
            const reason = data.result?.message || data.message || "Unknown API error";
            await conn.sendMessage(m.chat, { react: { text: "❌", key: message.key } });
            return reply(`❌ Background remove failed\n\nReason: ${reason}`);
        }

        const base64Data = data.result.base64.split(",")[1];
        const resultBuffer = Buffer.from(base64Data, "base64");

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
                caption:
`\`REMOVE BACKGROUND\`

📦 SIZE: ${size}

> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ 🍸*`
            },
            { quoted: m }
        );

    } catch (err) {

        await conn.sendMessage(m.chat, {
            react: { text: "❌", key: message.key }
        });

        reply(`❌ Background remove error: ${err.message}`);
    }
});
