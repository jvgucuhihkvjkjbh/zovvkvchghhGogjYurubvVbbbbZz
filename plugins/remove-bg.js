const axios = require("axios");
const FormData = require("form-data");
const { cmd } = require("../command");

const API_URL = "https://adeel-xtech-api.vercel.app/api/removebg";

async function uploadToCatbox(buffer) {
    try {
        const form = new FormData();
        form.append("reqtype", "fileupload");
        form.append("fileToUpload", buffer, "image.jpg");

        const res = await axios.post("https://catbox.moe/user/api.php", form, {
            headers: form.getHeaders(),
            timeout: 60000
        });

        const url = res.data?.toString().trim();
        if (!url || !url.startsWith("http")) return null;

        return url;

    } catch (e) {
        console.log("Catbox Upload Error:", e.message);
        return null;
    }
}

async function uploadToUguu(buffer) {
    try {
        const form = new FormData();
        form.append("files[]", buffer, "image.jpg");

        const res = await axios.post("https://uguu.se/upload.php", form, {
            headers: form.getHeaders(),
            timeout: 60000
        });

        const url = res.data?.files?.[0]?.url;
        if (!url) return null;

        return url;

    } catch (e) {
        console.log("Uguu Upload Error:", e.message);
        return null;
    }
}

async function uploadImage(buffer) {
    let url = await uploadToCatbox(buffer);
    if (url) return url;

    url = await uploadToUguu(buffer);
    if (url) return url;

    return null;
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

        if (!data || !data.status || !data.result) {
            return reply("❌ Failed to remove background");
        }

        const result = await axios.get(data.result, {
            responseType: "arraybuffer",
            timeout: 60000
        });
        const resultBuffer = Buffer.from(result.data);

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
        reply("❌ Background remove error, try again");
    }
});
