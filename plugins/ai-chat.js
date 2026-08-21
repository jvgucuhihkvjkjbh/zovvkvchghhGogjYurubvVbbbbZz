const { cmd } = require('../command');
const axios = require('axios');

const aiRequest = async (prompt) => {
    const apis = [
        {
            url: `https://adeel-xtech-apis.vercel.app/api/blackboxai?q=${encodeURIComponent(prompt)}`,
            extract: d => d?.result
        }
    ]

    for (const api of apis) {
        try {
            const res = await axios.get(api.url, { timeout: 12000 })
            const reply = api.extract(res.data)
            if (reply && reply.trim()) return reply.trim()
        } catch { continue }
    }
    return null
}

const buildPrompt = (q) => {
    return `You are a helpful AI assistant. 
IMPORTANT RULES:
- Detect the language of the user's message automatically
- Always reply in the EXACT same language the user wrote in
- If user writes in Urdu script → reply in Urdu script
- If user writes in Roman Urdu (Urdu words in English letters) → reply in Roman Urdu
- If user writes in English → reply in English
- If user writes in any other language → reply in that same language
- Be helpful, friendly and concise
- Never switch languages

User message: ${q}`
}

cmd({
    pattern: "ai",
    alias: ["gpt", "gpt4", "gpt5", "chatgpt", "deepseek", "openai", "adeel", "dj"],
    desc: "Chat with AI in any language",
    category: "ai",
    react: "🤖",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("⚠️ Please provide a prompt.\nExample: .ai Hello, how are you?")

        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } })

        const prompt = buildPrompt(q)
        const answer = await aiRequest(prompt)

        if (!answer) {
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } })
            return reply("❌ AI failed to respond. Please try again later.")
        }

        await reply(`🤖 ${answer}`)
        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } })

    } catch (e) {
        console.log("AI ERROR:", e.message)
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } })
        reply("❌ An error occurred while processing your request. Please try again.")
    }
})
