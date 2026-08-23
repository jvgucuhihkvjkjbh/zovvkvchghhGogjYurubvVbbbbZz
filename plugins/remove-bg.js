const axios = require("axios");
const FormData = require("form-data");
const { cmd } = require("../command");

const API_URL = "https://adeel-xtech-apis.vercel.app/api/removebg";

async function uploadImage(buffer) {
    try {
        const form = new FormData();
        form.append("reqtype", "fileupload");
        form.append("fileToUpload", buffer, "image.jpg");

        const res = await axios.post("https://catbox.moe/user/api.php", form, {
            headers: form.getHeaders(),
            timeout: 60000
        });

        const url = typeof res.data === "string" ? res.data.trim() : null;

        if (!url || !url.startsWith("http")) {
            console.log("Catbox Upload Failed, response:", res.data);
            return null;
        }

        return url;

    } catch (e) {
        console.log("Upload Error:", e.response?.data || e.message);
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

        console.log("Uploaded URL:", uploadedUrl);

        const api = `${API_URL}?url=${encodeURIComponent(uploadedUrl)}`;

        const response = await axios.get(api, {
            timeout: 60000
        });

        const data = response.data;

        if (
            !data.status ||
            !data.result ||
            !data.result.image_url
        ) {
            console.log("API Response:", data);
            return reply("❌ Failed to remove background");
        }

        const result = await axios.get(data.result.image_url, {
            responseType: "arraybuffer",
            timeout: 60000
        });

        const resultBuffer = Buffer.from(result.data);

        const size = data.result.size || (
            resultBuffer.length / 1024
        ).toFixed(2) + " KB";

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

        console.log("RMBG Error:", err.response?.data || err.message);

        await conn.sendMessage(m.chat, {
            react: { text: "❌", key: message.key }
        });

        reply("❌ Background remove error, try again");
    }
});
