const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { cmd } = require("../command");

const API_URL = "https://adeel-xtech-apis.vercel.app/api/removebg";

async function uploadToQuax(buffer, extension) {
    let tempFilePath;
    try {
        tempFilePath = path.join(os.tmpdir(), `rmbg_${Date.now()}${extension}`);
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
            return { success: false, error: `Qu.ax returned invalid response: ${JSON.stringify(response.data)}` };
        }

        return { success: true, url };

    } catch (e) {
        if (tempFilePath && fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
        }
        const detail = e.response?.data ? JSON.stringify(e.response.data) : e.message;
        return { success: false, error: `Qu.ax upload failed: ${detail}` };
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
            return reply("❌ *Failed to download image*\n\nReason: Media download from WhatsApp returned empty buffer.");
        }

        let extension = '.jpg';
        if (mime.includes('image/png')) extension = '.png';
        else if (mime.includes('image/webp')) extension = '.webp';

        const uploadResult = await uploadToQuax(buffer, extension);

        if (!uploadResult.success) {
            return reply(`❌ *Image upload failed*\n\nReason: ${uploadResult.error}`);
        }

        const uploadedUrl = uploadResult.url;

        const api = `${API_URL}?url=${encodeURIComponent(uploadedUrl)}`;

        let response;
        try {
            response = await axios.get(api, { timeout: 60000 });
        } catch (apiErr) {
            const detail = apiErr.response?.data ? JSON.stringify(apiErr.response.data) : apiErr.message;
            return reply(`❌ *RemoveBG API call failed*\n\nUploaded URL: ${uploadedUrl}\nReason: ${detail}`);
        }

        const data = response.data;

        if (
            !data.status ||
            !data.result ||
            !data.result.image_url
        ) {
            return reply(`❌ *Failed to remove background*\n\nUploaded URL: ${uploadedUrl}\nAPI Response: ${JSON.stringify(data)}`);
        }

        let result;
        try {
            result = await axios.get(data.result.image_url, {
                responseType: "arraybuffer",
                timeout: 60000
            });
        } catch (dlErr) {
            return reply(`❌ *Failed to download processed image*\n\nResult URL: ${data.result.image_url}\nReason: ${dlErr.message}`);
        }

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

        await conn.sendMessage(m.chat, {
            react: { text: "❌", key: message.key }
        });

        const detail = err.response?.data ? JSON.stringify(err.response.data) : (err.message || err);
        reply(`❌ *Background remove error*\n\nDetail: ${detail}`);
    }
});
