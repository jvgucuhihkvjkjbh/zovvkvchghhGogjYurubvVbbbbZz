const axios = require("axios");
const { cmd } = require("../command");

cmd({
    pattern: "sora",
    alias: ["aisora", "aivid", "aivideo"],
    desc: "Generate AI Video",
    category: "ai",
    react: "🎬",
    filename: __filename
},
async (conn, mek, m, { from, args, reply }) => {
    try {

        const prompt = args.join(" ");
        if (!prompt) return reply("❌ Please provide a prompt!");

        await conn.sendMessage(from, {
            react: { text: "⏳", key: mek.key }
        });

        const enhancedPrompt = `${prompt}, cinematic, high quality, smooth motion, 4k, longer video`;

        const api = `https://jerrycoder.oggyapi.workers.dev/ai/veo3?prompt=${encodeURIComponent(enhancedPrompt)}`;
        const res = await axios.get(api);

        if (!res.data || res.data.status !== "success") {
            return reply("❌ Failed to generate video!");
        }

        const videoUrl = res.data.url;

        await conn.sendMessage(from, {
            video: { url: videoUrl },
            caption: `*🎥 AI VIDEO GENERATED*

🧠 \`PROMPT\`: ${prompt}

> *© ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ*`
        }, { quoted: mek });

        await conn.sendMessage(from, {
            react: { text: "✅", key: mek.key }
        });

    } catch (e) {
        console.error("SORA ERROR:", e);
        reply("❌ Error generating video!");
    }
});