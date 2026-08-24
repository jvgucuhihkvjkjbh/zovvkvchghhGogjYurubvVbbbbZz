const { cmd } = require('../command');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Image Upload Helper — "tourl" command wala confirmed-working pattern
const uploadMedia = async (buffer, debugLog) => {
    debugLog.push(`📤 Upload start. Buffer size: ${buffer?.length || 'NO BUFFER'} bytes`);
    let tempFilePath = null;
    try {
        tempFilePath = path.join(os.tmpdir(), `gemini_upload_${Date.now()}.jpg`);
        fs.writeFileSync(tempFilePath, buffer);

        const form = new FormData();
        form.append('file', fs.createReadStream(tempFilePath), 'image.jpg');

        debugLog.push(`📤 Sending to imgtourl API...`);
        const res = await axios.post('https://adeel-xtech-apis.vercel.app/api/imgtourl', form, {
            headers: {
                ...form.getHeaders(),
                'User-Agent': 'Mozilla/5.0'
            },
            timeout: 60000
        });

        debugLog.push(`📤 imgtourl raw response: ${JSON.stringify(res.data)}`);

        if (res.data?.status && res.data?.result?.url) {
            const uploadedUrl = res.data.result.url.trim();
            debugLog.push(`✅ Upload success: ${uploadedUrl}`);
            return uploadedUrl;
        }

        debugLog.push(`❌ Response did not contain a valid URL.`);
    } catch (e) {
        debugLog.push(`❌ imgtourl Upload Error: ${e.message}`);
        if (e.response) {
            debugLog.push(`❌ Error status: ${e.response.status}`);
            debugLog.push(`❌ Error data: ${JSON.stringify(e.response.data)}`);
        }
    } finally {
        if (tempFilePath && fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
        }
    }
    return null;
};

// Result Image Download Helper — Pollinations (kontext) generation slow ho sakta hai,
// isliye seedha WhatsApp ko URL fetch karne ke bajaye pehle khud buffer bana lete hain,
// generous timeout ke sath.
const downloadResultImage = async (imageUrl, debugLog) => {
    debugLog.push(`⬇️ Downloading result image (this can take a while for edits)...`);
    try {
        const res = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 90000, // kontext edits slow ho sakte hain, 90s diya hai
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const buffer = Buffer.from(res.data);
        debugLog.push(`✅ Result image downloaded: ${buffer.length} bytes`);
        return buffer;
    } catch (e) {
        debugLog.push(`❌ Result image download failed: ${e.message}`);
        if (e.response) {
            debugLog.push(`❌ Error status: ${e.response.status}`);
        }
        return null;
    }
};

cmd({
    pattern: "gemini",
    alias: ["nano", "gemini2", "txt2img"],
    desc: "AI image generate or edit reply image",
    category: "ai",
    react: "🤖",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    const debugLog = [];

    try {
        debugLog.push(`🔹 Prompt (q): ${q || 'EMPTY'}`);

        if (!q) return reply("❌ Prompt likho ya kisi pic ko reply kar ke prompt likho!\n\nMisal 1: .gemini jungle mein larka khara hai\nMisal 2: (Image ko reply kar ke) .gemini is pic par ADEEL-X-MD likh do");

        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

        // Quoted / Replied message check for image
        const quoted = m.quoted ? m.quoted : null;
        debugLog.push(`🔹 Quoted message exists: ${!!quoted}`);

        const mime = (quoted?.msg || quoted)?.mimetype || '';
        debugLog.push(`🔹 Detected mimetype: ${mime || 'NONE'}`);

        let uploadedImageUrl = null;

        if (quoted && /image/.test(mime)) {
            debugLog.push(`🔹 Image detected. Downloading...`);
            const mediaBuffer = await quoted.download();
            debugLog.push(`🔹 Downloaded buffer: ${mediaBuffer ? `OK (${mediaBuffer.length} bytes)` : 'NULL/EMPTY'}`);

            if (mediaBuffer) {
                uploadedImageUrl = await uploadMedia(mediaBuffer, debugLog);
                debugLog.push(`🔹 uploadedImageUrl: ${uploadedImageUrl || 'NULL'}`);
            } else {
                debugLog.push(`❌ mediaBuffer is empty — download failed.`);
            }
        } else {
            debugLog.push(`🔹 No image reply detected — text-to-image mode.`);
        }

        // ADEEL-Xtech API Request
        let apiUrl = `https://adeel-xtech-apis.vercel.app/api/txt2img?prompt=${encodeURIComponent(q)}`;
        if (uploadedImageUrl) {
            apiUrl += `&url=${encodeURIComponent(uploadedImageUrl)}`;
        }

        debugLog.push(`🔹 Final API URL: ${apiUrl}`);

        const response = await axios.get(apiUrl, { timeout: 25000 });

        debugLog.push(`🔹 API Response: ${JSON.stringify(response.data)}`);

        if (response.data && response.data.status && response.data.result?.image_url) {
            const resultImg = response.data.result.image_url;

            // === Ab seedha URL WhatsApp ko fetch karne nahi dete, khud buffer download karte hain ===
            const imgBuffer = await downloadResultImage(resultImg, debugLog);

            // === DEBUG LOG WHATSAPP PAR BHEJO ===
            await reply("🛠️ *DEBUG LOG:*\n\n" + debugLog.join('\n'));

            if (!imgBuffer) {
                await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
                return reply("❌ Result image download nahi ho saki. Dobara try karo.");
            }

            await conn.sendMessage(from, {
                image: imgBuffer,
                caption: uploadedImageUrl 
                    ? `✏️ *AI Image Edited!*\n\n📝 *Prompt:* ${q}\n\n> *⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡*`
                    : `🖼️ *AI Image Generated!*\n\n📝 *Prompt:* ${q}\n\n> *⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡*`
            }, { quoted: mek });

            await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });
        } else {
            await reply("🛠️ *DEBUG LOG:*\n\n" + debugLog.join('\n'));
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply("❌ Image process nahi ho saki. Dobara try karo.");
        }

    } catch (e) {
        debugLog.push(`❌❌ FATAL ERROR: ${e.message}`);
        if (e.response) {
            debugLog.push(`❌❌ Error status: ${e.response.status}`);
            debugLog.push(`❌❌ Error data: ${JSON.stringify(e.response.data)}`);
        }
        await reply("🛠️ *DEBUG LOG (ERROR):*\n\n" + debugLog.join('\n'));

        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply("❌ Error occurred: " + (e.response?.data?.error || e.message));
    }
});
