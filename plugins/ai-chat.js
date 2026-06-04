const { cmd } = require('../command');
const axios = require('axios');
const { MongoClient } = require('mongodb');

const MONGO_URI = "mongodb+srv://iqra1587505_db_user:Adeel5512985@adeel678.g81ct9s.mongodb.net/";
const DB_NAME = "adeel_ai";
const COLLECTION = "ai_memory";

let db = null;
const localMemory = new Map();
const activeSessions = new Map();
const MAX_HISTORY = 10;
const SESSION_TIMEOUT = 60 * 1000;

async function connectDB() {
    if (db) return db;
    try {
        const client = new MongoClient(MONGO_URI);
        await client.connect();
        db = client.db(DB_NAME);
        console.log("AI Memory DB Connected");
        return db;
    } catch (e) {
        console.log("DB Connection Error:", e.message);
        return null;
    }
}

async function saveFullHistoryToDB(userId, history) {
    try {
        const database = await connectDB();
        if (!database) return;
        await database.collection(COLLECTION).updateOne(
            { userId },
            { $set: { userId, history, updatedAt: new Date() } },
            { upsert: true }
        );
        console.log(`History successfully backed up to MongoDB for: ${userId}`);
    } catch (e) {
        console.log("DB backup error:", e.message);
    }
}

const startSessionTimer = (userId, conn) => {
    if (activeSessions.has(userId)) clearTimeout(activeSessions.get(userId));
    
    const timer = setTimeout(async () => {
        activeSessions.delete(userId);
        const finalHistory = localMemory.get(userId) || [];
        if (finalHistory.length > 0) {
            await saveFullHistoryToDB(userId, finalHistory);
        }
        localMemory.delete(userId);
        console.log(`AI Session Expired for: ${userId}`);
    }, SESSION_TIMEOUT);

    activeSessions.set(userId, timer);
};

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
            const res = await axios.get(api.url, { timeout: 3000 });
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

        if (!localMemory.has(userId)) {
            localMemory.set(userId, []);
        }
        let history = localMemory.get(userId);

        const prompt = buildPrompt(q, history);
        const answer = await aiRequest(prompt);

        if (!answer) {
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply("❌ AI ne jawab nahi diya. Try again.");
        }

        history.push({ role: "user", content: q });
        history.push({ role: "ai", content: answer });
        if (history.length > MAX_HISTORY * 2) history.splice(0, 2);
        localMemory.set(userId, history);

        await conn.sendMessage(from, { text: `🤖 ${answer}` }, { quoted: m });
        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });

        startSessionTimer(userId, conn);

        if (!global.aiUpsertRegistered) {
            global.aiUpsertRegistered = true;
            conn.ev.on("messages.upsert", async (chatUpdate) => {
                try {
                    const msg = chatUpdate.messages[0];
                    if (!msg.message || msg.key.fromMe) return;

                    const fromJid = msg.key.remoteJid;
                    const senderJid = msg.key.participant || msg.key.remoteJid;
                    const sessionUser = senderJid;

                    if (!activeSessions.has(sessionUser)) return;

                    let userText = msg.message.conversation || 
                                   msg.message.extendedTextMessage?.text || "";
                    
                    userText = userText.trim();
                    if (!userText) return;

                    if (userText.startsWith(".") || userText.startsWith("/") || userText.startsWith("!")) return;

                    startSessionTimer(sessionUser, conn);

                    await conn.sendMessage(fromJid, { react: { text: "⏳", key: msg.key } });

                    let currentHistory = localMemory.get(sessionUser) || [];
                    const nextPrompt = buildPrompt(userText, currentHistory);
                    const nextAnswer = await aiRequest(nextPrompt);

                    if (!nextAnswer) {
                        await conn.sendMessage(fromJid, { react: { text: "❌", key: msg.key } });
                        return;
                    }

                    currentHistory.push({ role: "user", content: userText });
                    currentHistory.push({ role: "ai", content: nextAnswer });
                    if (currentHistory.length > MAX_HISTORY * 2) currentHistory.splice(0, 2);
                    localMemory.set(sessionUser, currentHistory);

                    await conn.sendMessage(fromJid, {
                        text: `🤖 ${nextAnswer}`
                    }, { quoted: msg });

                    await conn.sendMessage(fromJid, { react: { text: "✅", key: msg.key } });

                } catch (err) {
                    console.log("Global JID AI Listener Error:", err.message);
                }
            });
        }

    } catch (e) {
        console.log("AI ERROR:", e.message);
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply("❌ Error occurred. Try again.");
    }
});
