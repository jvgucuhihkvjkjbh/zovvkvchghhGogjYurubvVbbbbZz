const { cmd } = require('../command');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const os = require('os');
const path = require('path');

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
    alias: ["nano", "gemini2", "ask"],
    desc: "AI Chat or Analyze reply image using Gemini 3.6",
    category: "ai",
    react: "🤖",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) {
            return reply("❌ Please ask a question or reply to an image with a question!");
        }

        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

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

        let apiUrl = `https://adeel-xtech-apis.vercel.app/api/txt2img?prompt=${encodeURIComponent(q)}`;
        if (uploadedImageUrl) {
            apiUrl += `&url=${encodeURIComponent(uploadedImageUrl)}`;
        }

        const response = await axios.get(apiUrl, { timeout: 60000 });

        if (response.data && response.data.status && response.data.result) {
            const aiTextResponse = response.data.result;

            // Sends Text response instead of Image
            await reply(`${aiTextResponse}\n\n> *⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡*`);
            await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });
        } else {
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply("❌ Failed to get response from Gemini 3.6. Please try again.");
        }

    } catch (e) {
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        const errorMsg = e.response?.data?.error || e.message || "Unknown error occurred";
        reply(`❌ Error: ${errorMsg}`);
    }
});
