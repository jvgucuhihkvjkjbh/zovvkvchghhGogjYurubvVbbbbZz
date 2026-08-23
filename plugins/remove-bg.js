const axios = require("axios");
const FormData = require("form-data");
const { cmd } = require("../command");

const API_URL = "https://adeel-xtech-apis.vercel.app/api/removebg";

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

        const form = new FormData();
        form.append("image", buffer, "image.jpg");

        let response;
        try {
            response = await axios.post(API_URL, form, {
                headers: form.getHeaders(),
                timeout: 60000
            });
        } catch (apiErr) {
            const detail = apiErr.response?.data ? JSON.stringify(apiErr.response.data) : apiErr.message;
            return reply(`❌ *RemoveBG API call failed*\n\nReason: ${detail}`);
        }

        const data = response.data;

        if (
            !data.status ||
            !data.result ||
            !data.result.image_url
        ) {
            return reply(`❌ *Failed to remove background*\n\nAPI Response: ${JSON.stringify(data)}`);
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
