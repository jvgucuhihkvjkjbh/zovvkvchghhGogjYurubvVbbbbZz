const axios = require("axios");
const FormData = require("form-data");
const { cmd } = require("../command");

const API_URL = "https://adeel-xtech-api.vercel.app/api/removebg";

async function uploadImage(buffer) {
    try {
        const form = new FormData();
        form.append("reqtype", "fileupload");
        form.append("fileToUpload", buffer, "image.jpg");

        const res = await axios.post("https://catbox.moe/user/api.php", form, {
            headers: form.getHeaders(),
            timeout: 60000
        });

        const url = res.data?.trim();

        if (!url || !url.startsWith("http")) return null;

        return url;

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
            return reply("❌ تصویر پر ریپلائی کریں");
        }

        await conn.sendMessage(m.chat, {
            react: { text: "⏳", key: message.key }
        });

        const buffer = await quoted.download();

        if (!buffer) {
            return reply("❌ تصویر ڈاؤن لوڈ نہیں ہو سکی");
        }

        const uploadedUrl = await uploadImage(buffer);

        if (!uploadedUrl) {
            return reply("❌ تصویر اپلوڈ نہیں ہو سکی");
        }

        const api = `${API_URL}?url=${encodeURIComponent(uploadedUrl)}`;

        let data;
        try {
            const response = await axios.get(api, {
                timeout: 60000,
                validateStatus: () => true
            });
            data = response.data;
        } catch (apiErr) {
            await conn.sendMessage(m.chat, { react: { text: "❌", key: message.key } });
            return reply(`❌ بیک گراؤنڈ ہٹانے میں ناکامی\n\nوجہ: ${apiErr.message}`);
        }

        if (!data.success || !data.result?.success || !data.result?.base64) {
            const reason = data.result?.errors?.join(" | ") || data.result?.error || data.result?.message || data.message || "نامعلوم خرابی";
            await conn.sendMessage(m.chat, { react: { text: "❌", key: message.key } });
            return reply(`❌ بیک گراؤنڈ ہٹانے میں ناکامی\n\nوجہ: ${reason}`);
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

        reply(`❌ خرابی: ${err.message}`);
    }
});
