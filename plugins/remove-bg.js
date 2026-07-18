const axios = require("axios");
const FormData = require("form-data");
const { cmd } = require("../command");

const REMOVEBG_API_KEY = "8D1tE7SaywC7VKxhUHGqBDFm";

async function removeBg(imageBuffer) {
    const form = new FormData();
    form.append("image_file", imageBuffer, "image.jpg");
    form.append("size", "auto");

    const res = await axios.post("https://api.remove.bg/v1.0/removebg", form, {
        headers: {
            ...form.getHeaders(),
            "X-Api-Key": REMOVEBG_API_KEY
        },
        responseType: "arraybuffer",
        timeout: 60000
    });

    return Buffer.from(res.data);
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

        let resultBuffer;
        try {
            resultBuffer = await removeBg(buffer);
        } catch (apiErr) {
            const errData = apiErr.response?.data;
            let errMsg = apiErr.message;

            if (errData) {
                try {
                    const parsed = JSON.parse(Buffer.from(errData).toString());
                    errMsg = parsed?.errors?.[0]?.title || errMsg;
                } catch {}
            }

            await conn.sendMessage(m.chat, {
                react: { text: "❌", key: message.key }
            });
            return reply(`❌ Background remove failed\n\nReason: ${errMsg}`);
        }

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

        console.log("RMBG Error:", err.message);

        await conn.sendMessage(m.chat, {
            react: { text: "❌", key: message.key }
        });

        reply(`❌ Background remove error: ${err.message}`);
    }
});
