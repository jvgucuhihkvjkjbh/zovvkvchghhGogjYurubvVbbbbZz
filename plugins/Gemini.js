const { cmd } = require('../command');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Image Upload Helper
const uploadMedia = async (buffer) => {
    let tempFilePath = null;
    try {
        tempFilePath = path.join(os.tmpdir(), `gemini_upload_${Date.now()}.jpg`);
        fs.writeFileSync(tempFilePath, buffer);

        const form = new FormData();
        form.append('file', fs.createReadStream(tempFilePath), 'image.jpg');

        const res = await axios.post('https://adeel-xtech-apis.vercel.app/api/imgtourl', form, {
            headers: {
                ...form.getHeaders(),
                'User-Agent': 'Mozilla/5.0'
            },
            timeout: 30000
        });

        if (res.data?.status && res.data?.result?.url) {
            return res.data.result.url.trim();
        }
    } catch (e) {
        console.error("Upload Error:", e.message);
    } finally {
        if (tempFilePath && fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
        }
    }
    return null;
};

cmd({
    pattern: "gemini",
    alias: ["nano", "gemini2", "txt2img"],
    desc: "AI image generate or edit reply image",
    category: "ai",
    react: "🤖",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) {
            return reply("❌ Please provide a prompt or reply to an image with a prompt!\n\n*Example 1:* .gemini A futuristic city\n*Example 2:* (Reply to image) .gemini Add red sunglasses");
        }

        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

        // Quoted Message Image Processing
        const quoted = m.quoted ? m.quoted : null;
        const mime = (quoted?.msg || quoted)?.mimetype || '';
        let uploadedImageUrl = null;

        if (quoted && /image/.test(mime)) {
            const mediaBuffer = await quoted.download();
            if (mediaBuffer) {
                uploadedImageUrl = await uploadMedia(mediaBuffer);
                if (!uploadedImageUrl) {
                    await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
                    return reply("❌ Failed to upload reference image. Please try again.");
                }
            }
        }

        // Call Adeel-Xtech API
        let apiUrl = `https://adeel-xtech-apis.vercel.app/api/txt2img?prompt=${encodeURIComponent(q)}`;
        if (uploadedImageUrl) {
            apiUrl += `&url=${encodeURIComponent(uploadedImageUrl)}`;
        }

        const response = await axios.get(apiUrl, { timeout: 60000 });

        if (response.data && response.data.status && response.data.result?.image_url) {
            const resultImg = response.data.result.image_url;

            await conn.sendMessage(from, {
                image: { url: resultImg },
                caption: uploadedImageUrl 
                    ? `✏️ *AI Image Edited!*\n\n📝 *Prompt:* ${q}\n\n> *⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡*`
                    : `🖼️ *AI Image Generated!*\n\n📝 *Prompt:* ${q}\n\n> *⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡*`
            }, { quoted: mek });

            await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });
        } else {
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply("❌ Failed to process image. Please try again.");
        }

    } catch (e) {
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        const errorMsg = e.response?.data?.error || e.message || "Unknown error occurred";
        reply(`❌ Error: ${errorMsg}`);
    }
});
