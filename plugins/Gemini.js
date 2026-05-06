const { cmd } = require('../command');
const axios = require('axios');

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
    const encoded = encodeURIComponent(prompt);
    const apis = [
        `https://jerrycoder.oggyapi.workers.dev/ai/poll?prompt=${encoded}`,
        `https://image.pollinations.ai/prompt/${encoded}?model=flux&width=960&height=1280&enhance=true&nologo=true`,
        `https://image.pollinations.ai/prompt/${encoded}?model=turbo&width=960&height=1280&nologo=true`
    ];

    for (const url of apis) {
        try {
            if (url.includes('oggyapi')) {
                const res = await axios.get(url, { timeout: 15000 });
                if (res.data?.status === "success" && res.data?.image) {
                    return res.data.image;
                }
            } else {
                await axios.head(url, { timeout: 15000 });
                return url;
            }
        } catch (e) {
            continue;
        }
    }
    return null;
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
        const imageUrl = await getImageUrl(englishPrompt);

        if (!imageUrl) {
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply("❌ Image generate nahi hui. Dobara try karo.");
        }

        await conn.sendMessage(from, {
            image: { url: imageUrl },
            caption: `🖼️ *AI Image Generated!*\n\n📝 *Prompt:* ${q}\n\n> *⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡*`
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });

    } catch (e) {
        console.log("AI ERROR:", e.message);
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply("❌ Error occurred. Try again.");
    }
});