const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { cmd } = require("../command");

const API_URL = "https://adeel-xtech-apis.vercel.app/api/removebg";

async function uploadToQuax(buffer, extension) {
    try {
        const tempFilePath = path.join(os.tmpdir(), `rmbg_${Date.now()}${extension}`);
        fs.writeFileSync(tempFilePath, buffer);

        const form = new FormData();
        form.append('files[]', fs.createReadStream(tempFilePath), `file${extension}`);

        const response = await axios.post('https://qu.ax/upload.php', form, {
            headers: {
                Origin: 'https://qu.ax',
                Referer: 'https://qu.ax/',
                ...form.getHeaders(),
                'User-Agent': 'Mozilla/5.0'
            },
            timeout: 60000
        });

        if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
        }

        const url = response.data?.files?.[0]?.url?.trim();

        if (!url || url.toLowerCase().includes('error')) {
            return null;
        }

        return url;

    } catch (e) {
        console.log("Qu.ax Upload Error:", e.response?.data || e.message);
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

        let extension = '.jpg';
        if (mime.includes('image/png')) extension = '.png';
        else if (mime.includes('image/webp')) extension = '.webp';

        const uploadedUrl = await uploadToQuax(buffer, extension);

        if (!uploadedUrl) {
            return reply("❌ Image upload failed");
        }

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
