const { cmd } = require('../command');
const axios = require('axios');

const userMemory = new Map();
const MAX_HISTORY = 10;

const activeSessions = new Map();
const SESSION_TIMEOUT = 60 * 1000;

const getHistory = (userId) => userMemory.get(userId) || [];

const saveHistory = (userId, role, content) => {
    const history = getHistory(userId);
    history.push({ role, content });
    if (history.length > MAX_HISTORY) history.splice(0, 1);
    userMemory.set(userId, history);
};

const setSession = (userId) => {
    if (activeSessions.has(userId)) clearTimeout(activeSessions.get(userId));
    const timer = setTimeout(() => {
        activeSessions.delete(userId);
    }, SESSION_TIMEOUT);
    activeSessions.set(userId, timer);
};

const hasSession = (userId) => activeSessions.has(userId);

const buildPrompt = (q, history) => {
    let conversation = "";
    if (history.length > 0) {
        conversation = "\n\nPrevious conversation:\n" +
            history.map(h => `${h.role === "user" ? "User" : "AI"}: ${h.content}`).join("\n");
    }
    return `You are a helpful AI assistant named ADEEL-AI.
IMPORTANT RULES:
- Detect the language of the user's message automatically
- Always reply in the EXACT same language the user wrote in
- If user writes in Urdu script → reply in Urdu script
- If user writes in Roman Urdu → reply in Roman Urdu
- If user writes in English → reply in English
- Remember the conversation context and be consistent
- If asked to write code or commands, write them properly
- Be helpful, friendly and concise
- Never switch languages${conversation}

User message: ${q}`;
};

const aiRequest = async (prompt) => {
    const apis = [
        {
            url: `https://jerrycoder.oggyapi.workers.dev/ai/gpt4?prompt=${encodeURIComponent(prompt)}&model=8.8`,
            extract: d => d?.reply?.message
        },
        {
            url: `https://jerrycoder.oggyapi.workers.dev/ai/gpt4?prompt=${encodeURIComponent(prompt)}&model=5.6`,
            extract: d => d?.reply?.message
        },
        {
            url: `https://jerrycoder.oggyapi.workers.dev/ai/gpt4?prompt=${encodeURIComponent(prompt)}&model=4.3`,
            extract: d => d?.reply?.message
        },
        {
            url: `https://jerrycoder.oggyapi.workers.dev/ai/gemini?prompt=${encodeURIComponent(prompt)}`,
            extract: d => d?.reply
        },
        {
            url: `https://jerrycoder.oggyapi.workers.dev/ai/gpt?q=${encodeURIComponent(prompt)}`,
            extract: d => d?.reply
        },
        {
            url: `https://lance-frank-asta.onrender.com/api/gpt?q=${encodeURIComponent(prompt)}`,
            extract: d => d?.message
        },
        {
            url: `https://vapis.my.id/api/openai?q=${encodeURIComponent(prompt)}`,
            extract: d => d?.result
        },
        {
            url: `https://api.ryzendesu.vip/api/ai/deepseek?text=${encodeURIComponent(prompt)}`,
            extract: d => d?.answer
        }
    ];

    for (const api of apis) {
        try {
            const res = await axios.get(api.url, { timeout: 12000 });
            const reply = api.extract(res.data);
            if (reply && reply.trim()) return reply.trim();
        } catch { continue; }
    }
    return null;
};

cmd({
    pattern: "ai",
    alias: ["gpt", "gpt4", "gpt5", "chatgpt", "deepseek", "openai", "adeel", "dj"],
    desc: "Chat with AI in any language",
    category: "ai",
    react: "🤖",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("⚠️ Kuch likho\nMisal: .ai Salam kya hal hai");

        const userId = m.sender || from;

        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

        const history = getHistory(userId);
        const prompt = buildPrompt(q, history);
        const answer = await aiRequest(prompt);

        if (!answer) {
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply("❌ AI ne jawab nahi diya. Try again.");
        }

        saveHistory(userId, "user", q);
        saveHistory(userId, "ai", answer);

        setSession(userId);

        await reply(`🤖 ${answer}`);
        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });

    } catch (e) {
        console.log("AI ERROR:", e.message);
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply("❌ Error occurred. Try again.");
    }
});

conn.ev.on("messages.upsert", async ({ messages }) => {
    for (const msg of messages) {
        try {
            if (!msg.message) continue;
            if (msg.key.fromMe) continue;

            const from = msg.key.remoteJid;
            const sender = msg.key.participant || msg.key.remoteJid;

            const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
            if (!contextInfo?.quotedMessage) continue;

            const quotedParticipant = contextInfo.participant || contextInfo.remoteJid;
            const botJid = conn.user?.id?.split(":")[0] + "@s.whatsapp.net";
            if (quotedParticipant !== botJid) continue;

            const userText = msg.message?.extendedTextMessage?.text?.trim();
            if (!userText) continue;

            if (userText.startsWith(".") || userText.startsWith("/") || userText.startsWith("!")) continue;

            const userId = sender;

            if (!hasSession(userId)) continue;

            await conn.sendMessage(from, { react: { text: "⏳", key: msg.key } });

            const history = getHistory(userId);
            const prompt = buildPrompt(userText, history);
            const answer = await aiRequest(prompt);

            if (!answer) {
                await conn.sendMessage(from, { react: { text: "❌", key: msg.key } });
                continue;
            }

            saveHistory(userId, "user", userText);
            saveHistory(userId, "ai", answer);

            setSession(userId);

            await conn.sendMessage(from, {
                text: `🤖 ${answer}`
            }, { quoted: msg });

            await conn.sendMessage(from, { react: { text: "✅", key: msg.key } });

        } catch (e) {
            console.log("AI Reply Error:", e.message);
        }
    }
});
