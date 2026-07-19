const { cmd } = require('../command');
const axios = require('axios');

const API_URL = "https://adeel-xtech-api.vercel.app/api/txt2img";

const translateToEnglish = async (text) => {
    try {
        const res = await axios.get(
            `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`,
            { timeout: 5000 }
        );
        return res.data[0].map(x => x[0]).join('');
    } catch (e) {
        return text;
    }
};

const getImageUrl = async (prompt) => {
    try {
        const res = await axios.get(
            `${API_URL}?prompt=${encodeURIComponent(prompt)}`,
            { timeout: 30000 }
        );
        const data = res.data;

        if (!data || data.status !== true || !data.result) {
            return { success: false, error: data?.error || "Image generate nahi ho saki" };
        }

        return { success: true, url: data.result };
    } catch (e) {
        const apiError = e.response?.data?.error || e.message;
        return { success: false, error: apiError };
    }
};

cmd({
    pattern: "gemini",
    alias: ["nano", "gemini2"],
    desc: "AI image generate",
    category: "ai",
    react: "🤖",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("❌ Prompt likho\nMisal: .gemini jungle mein larka khara hai");

        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

        const englishPrompt = await translateToEnglish(q);
        const result = await getImageUrl(englishPrompt);

        if (!result.success) {
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply(`❌ Error: ${result.error}`);
        }

        await conn.sendMessage(from, {
            image: { url: result.url },
            caption: `🖼️ *AI Image Generated!*\n\n📝 *Prompt:* ${q}\n\n> *⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡*`
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });

    } catch (e) {
        console.log("AI IMAGE ERROR:", e.message);
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply(`❌ Error: ${e.message}`);
    }
});
