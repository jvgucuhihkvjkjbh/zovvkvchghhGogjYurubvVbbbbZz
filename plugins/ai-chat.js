const { cmd } = require('../command');
const axios = require('axios');
const { MongoClient } = require('mongodb');

const MONGO_URI = "mongodb+srv://iqra1587505_db_user:Adeel5512985@adeel678.g81ct9s.mongodb.net/";
const DB_NAME = "adeel_ai";
const COLLECTION = "ai_memory";

let db = null;
const localMemory = new Map();
const activeSessions = new Map();
const userTimers = new Map();
const MAX_HISTORY = 10;
const SESSION_TIMEOUT = 60 * 1000;

const normalizeId = (id) => {
    if (!id) return '';
    return id
        .replace(/:[0-9]+/g, '')
        .replace(/@(lid|s.whatsapp.net|c.us|g.us)/g, '')
        .replace(/[^\d]/g, '');
};

async function connectDB() {
    if (db) return db;
    try {
        const client = new MongoClient(MONGO_URI);
        await client.connect();
        db = client.db(DB_NAME);
        return db;
    } catch (e) {
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
    } catch (e) {}
}

const startSessionTimer = (userId) => {
    if (userTimers.has(userId)) {
        clearTimeout(userTimers.get(userId));
        userTimers.delete(userId);
    }
    
    const timer = setTimeout(async () => {
        activeSessions.delete(userId);
        const finalHistory = localMemory.get(userId) || [];
        if (finalHistory.length > 0) {
            await saveFullHistoryToDB(userId, finalHistory);
        }
        localMemory.delete(userId);
        userTimers.delete(userId);
    }, SESSION_TIMEOUT);

    userTimers.set(userId, timer);
    activeSessions.set(userId, true);
};

const buildPrompt = (q, history) => {
    let conversation = "";
    if (history.length > 0) {
        conversation = "\n\nPrevious conversation:\n" +
            history.map(h => `${h.role === "user" ? "User" : "AI"}: ${h.content}`).join("\n");
    }
    return `You are a helpful AI assistant named ADEEL-AI.
CRITICAL RULES FOR LANGUAGE:
- If user writes in Urdu script (اردو) -> strictly reply in proper Urdu script
- If user writes in Roman Urdu (e.g., 'kya hal hai') -> reply in Roman Urdu
- If user writes in English -> reply in English
- Always match the user's language script perfectly.

GENERAL RULES:
- Remember the conversation context and be consistent
- Be helpful, friendly and concise${conversation}

User message: ${q}`;
};

const aiRequest = async (prompt) => {
    const apis = [
        {
            url: `https://jerrycoder.oggyapi.workers.dev/ai/gpt4?prompt=${encodeURIComponent(prompt)}&model=8.8`,
            extract: d => d?.reply?.message
        },
        {
            url: `https://jerrycoder.oggyapi.workers.dev/ai/gemini?prompt=${encodeURIComponent(prompt)}`,
            extract: d => d?.reply
        },
        {
            url: `https://api.ryzendesu.vip/api/ai/deepseek?text=${encodeURIComponent(prompt)}`,
            extract: d => d?.answer
        }
    ];

    for (const api of apis) {
        try {
            const res = await axios.get(api.url, { timeout: 5000 });
            const reply = api.extract(res.data);
            if (reply && reply.trim()) return reply.trim();
        } catch { continue; }
    }
    return null;
};

cmd({
    pattern: "ai",
    alias: ["gpt", "chatgpt", "deepseek"],
    desc: "Chat with AI",
    category: "ai",
    react: "🤖",
    filename: __filename
}, async (conn, mek, m, { from, q, reply, sender }) => {
    try {
        if (!q) return reply("⚠️ Kuch likho\nMisal: .ai Salam kya hal hai");

        const normalizedUser = normalizeId(sender || from);
        
        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

        if (!localMemory.has(normalizedUser)) {
            localMemory.set(normalizedUser, []);
        }
        let history = localMemory.get(normalizedUser);

        const prompt = buildPrompt(q, history);
        const answer = await aiRequest(prompt);

        if (!answer) {
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply("❌ AI ne jawab nahi diya.");
        }

        history.push({ role: "user", content: q });
        history.push({ role: "ai", content: answer });
        if (history.length > MAX_HISTORY * 2) history.splice(0, 2);
        localMemory.set(normalizedUser, history);

        await conn.sendMessage(from, { text: `🤖 ${answer}` }, { quoted: m });
        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });

        startSessionTimer(normalizedUser);
        
        await conn.sendMessage(from, { text: `✅ Session Active for 60 sec - Now reply to my message` });

    } catch (e) {
        console.log("AI ERROR:", e.message);
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply("❌ Error occurred.");
    }
});

cmd({
    on: "message"
}, async (conn, m, store, { from, body, sender }) => {
    try {
        if (!m.message) return;
        
        let messageBody = '';
        let isQuoted = false;
        let quotedParticipant = '';
        
        if (m.message.conversation) {
            messageBody = m.message.conversation;
        } else if (m.message.extendedTextMessage) {
            messageBody = m.message.extendedTextMessage.text || '';
            if (m.message.extendedTextMessage.contextInfo) {
                const ctx = m.message.extendedTextMessage.contextInfo;
                if (ctx.quotedMessage) {
                    isQuoted = true;
                    quotedParticipant = ctx.participant || ctx.remoteJid || '';
                }
            }
        }
        
        if (!messageBody) return;
        if (m.key.fromMe) return;
        
        const normalizedUser = normalizeId(sender || from);
        const botNumber = conn.user.id.split(':')[0] + '@s.whatsapp.net';
        
        let isReplyingToBot = false;
        if (isQuoted && quotedParticipant === botNumber) {
            isReplyingToBot = true;
        }
        
        const isSessionActive = activeSessions.has(normalizedUser);
        
        if (!isSessionActive && !isReplyingToBot) return;
        
        if (messageBody.startsWith(".") || messageBody.startsWith("/") || messageBody.startsWith("!")) return;
        
        if (isReplyingToBot) {
            startSessionTimer(normalizedUser);
        } else if (!isSessionActive) {
            return;
        }
        
        await conn.sendMessage(from, { react: { text: "⏳", key: m.key } });
        
        let currentHistory = localMemory.get(normalizedUser) || [];
        const nextPrompt = buildPrompt(messageBody, currentHistory);
        const nextAnswer = await aiRequest(nextPrompt);
        
        if (!nextAnswer) {
            await conn.sendMessage(from, { react: { text: "❌", key: m.key } });
            return;
        }
        
        currentHistory.push({ role: "user", content: messageBody });
        currentHistory.push({ role: "ai", content: nextAnswer });
        if (currentHistory.length > MAX_HISTORY * 2) currentHistory.splice(0, 2);
        localMemory.set(normalizedUser, currentHistory);
        
        await conn.sendMessage(from, { text: `🤖 ${nextAnswer}` }, { quoted: m });
        await conn.sendMessage(from, { react: { text: "✅", key: m.key } });
        
    } catch (err) {
        console.log("AI Error:", err.message);
    }
});
