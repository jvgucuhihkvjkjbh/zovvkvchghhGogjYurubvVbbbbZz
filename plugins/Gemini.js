const { cmd } = require('../command');
const axios = require('axios');

// Image Upload Helper (Catbox / Telegraph)
const uploadMedia = async (buffer) => {
    try {
        const FormData = require('form-data');
        const form = new FormData();
        form.append('reqtype', 'fileupload');
        form.append('fileToUpload', buffer, { filename: 'image.jpg' });

        const res = await axios.post('https://catbox.moe/user/api.php', form, {
            headers: form.getHeaders(),
            timeout: 15000
        });

        if (res.data && typeof res.data === 'string' && res.data.startsWith('http')) {
            return res.data.trim();
        }
    } catch (e) {
        console.log("Catbox Upload Error:", e.message);
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
        if (!q) return reply("❌ Prompt likho ya kisi pic ko reply kar ke prompt likho!\n\nMisal 1: .gemini jungle mein larka khara hai\nMisal 2: (Image ko reply kar ke) .gemini is pic par ADEEL-X-MD likh do");

        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

        // Quoted / Replied message check for image
        const quoted = m.quoted ? m.quoted : null;
        const mime = (quoted?.msg || quoted)?.mimetype || '';
        let uploadedImageUrl = null;

        if (quoted && /image/.test(mime)) {
            const mediaBuffer = await quoted.download();
            if (mediaBuffer) {
                uploadedImageUrl = await uploadMedia(mediaBuffer);
            }
        }

        // ADEEL-Xtech API Request
        let apiUrl = `https://adeel-xtech-apis.vercel.app/api/txt2img?prompt=${encodeURIComponent(q)}`;
        if (uploadedImageUrl) {
            apiUrl += `&url=${encodeURIComponent(uploadedImageUrl)}`;
        }

        const response = await axios.get(apiUrl, { timeout: 25000 });

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
            return reply("❌ Image process nahi ho saki. Dobara try karo.");
        }

    } catch (e) {
        console.log("AI ERROR:", e.message);
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply("❌ Error occurred: " + (e.response?.data?.error || e.message));
    }
});
