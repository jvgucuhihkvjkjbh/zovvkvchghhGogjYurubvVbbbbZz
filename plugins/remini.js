const axios = require("axios");
const FormData = require("form-data");
const { cmd } = require("../command");

const API_URL = "https://api.princetechn.com/api/tools/remini?apikey=prince";

async function uploadImage(buffer) {
    try {

        const form = new FormData();
        form.append("file", buffer, "image.jpg");

        const res = await axios.post(
            "https://tmpfiles.org/api/v1/upload",
            form,
            {
                headers: form.getHeaders(),
                timeout: 60000
            }
        );

        if (!res.data?.data?.url) return null;

        return res.data.data.url.replace(
            "https://tmpfiles.org/",
            "https://tmpfiles.org/dl/"
        );

    } catch (e) {
        console.log("Upload Error:", e.message);
        return null;
    }
}

cmd({
    pattern: "remini",
    alias: ["enhance", "hd"],
    react: "✨",
    desc: "Enhance image quality",
    category: "tools",
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

        const api = `${API_URL}&url=${encodeURIComponent(uploadedUrl)}`;

        const response = await axios.get(api, {
            timeout: 120000
        });

        const data = response.data;

        if (
            !data ||
            !data.success ||
            !data.result
        ) {
            console.log("API Error:", data);
            return reply("❌ Failed to enhance image");
        }

        let resultUrl = null;

        if (typeof data.result === "string") {
            resultUrl = data.result;
        } else if (data.result.image) {
            resultUrl = data.result.image;
        } else if (data.result.url) {
            resultUrl = data.result.url;
        }

        if (!resultUrl) {
            return reply("❌ Invalid API response");
        }

        const img = await axios.get(resultUrl, {
            responseType: "arraybuffer",
            timeout: 120000
        });

        const resultBuffer = Buffer.from(img.data);

        const formatBytes = (bytes) => {
            if (bytes === 0) return "0 Bytes";

            const k = 1024;
            const sizes = ["Bytes", "KB", "MB"];
            const i = Math.floor(Math.log(bytes) / Math.log(k));

            return parseFloat(
                (bytes / Math.pow(k, i)).toFixed(2)
            ) + " " + sizes[i];
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
`✨ *REMINI ENHANCED IMAGE*

📦 *SIZE:* ${size}

> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡`
            },
            { quoted: m }
        );

    } catch (err) {

        console.log("Remini Error:", err.message);

        await conn.sendMessage(m.chat, {
            react: { text: "❌", key: message.key }
        });

        reply("❌ Remini enhancement failed, try again");
    }
});
