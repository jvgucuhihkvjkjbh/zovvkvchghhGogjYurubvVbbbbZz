const { cmd } = require('../command');
const axios = require('axios');
const { MongoClient } = require('mongodb');

const MONGO_URI = "mongodb+srv://iqra1587505_db_user:Adeel5512985@adeel678.g81ct9s.mongodb.net/";
const DB_NAME = "adeel_ai";
const COLLECTION = "ai_memory";

const MAX_HISTORY = 10;
const SESSION_TIMEOUT = 60 * 1000;

let db = null;

/*
|--------------------------------------------------------------------------
| MEMORY & SESSION STORAGE
|--------------------------------------------------------------------------
*/

const localMemory = new Map();

/*
sessions = {
   sessionKey: {
      timer,
      lastAiMessageId
   }
}
*/
const sessions = new Map();

/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

const normalizeId = (id) => {
    if (!id) return '';

    return id
        .replace(/:[0-9]+/g, '')
        .replace(/@(lid|s.whatsapp.net|c.us|g.us)/g, '')
        .replace(/[^\d]/g, '');
};

const getSessionKey = (chatId, senderId) => {
    return `${chatId}:${normalizeId(senderId)}`;
};

const getQuotedMessageId = (m) => {
    try {
        return (
            m?.message?.extendedTextMessage?.contextInfo?.stanzaId ||
            m?.msg?.contextInfo?.stanzaId ||
            m?.quoted?.id ||
            null
        );
    } catch {
        return null;
    }
};

/*
|--------------------------------------------------------------------------
| DATABASE
|--------------------------------------------------------------------------
*/

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
            {
                $set: {
                    userId,
                    history,
                    updatedAt: new Date()
                }
            },
            { upsert: true }
        );

        console.log(`History backed up for ${userId}`);
    } catch (e) {
        console.log("Mongo Backup Error:", e.message);
    }
}

/*
|--------------------------------------------------------------------------
| SESSION MANAGEMENT
|--------------------------------------------------------------------------
*/

async function destroySession(sessionKey) {
    try {
        const history = localMemory.get(sessionKey) || [];

        if (history.length > 0) {
            await saveFullHistoryToDB(sessionKey, history);
        }

        localMemory.delete(sessionKey);

        const session = sessions.get(sessionKey);

        if (session?.timer) {
            clearTimeout(session.timer);
        }

        sessions.delete(sessionKey);

        console.log(`Session expired -> ${sessionKey}`);
    } catch (err) {
        console.log("Destroy Session Error:", err.message);
    }
}

function startSession(sessionKey, botMessageId) {
    const existing = sessions.get(sessionKey);

    if (existing?.timer) {
        clearTimeout(existing.timer);
    }

    const timer = setTimeout(async () => {
        await destroySession(sessionKey);
    }, SESSION_TIMEOUT);

    sessions.set(sessionKey, {
        timer,
        lastAiMessageId: botMessageId
    });
}

function refreshSession(sessionKey) {
    const session = sessions.get(sessionKey);

    if (!session) return;

    clearTimeout(session.timer);

    session.timer = setTimeout(async () => {
        await destroySession(sessionKey);
    }, SESSION_TIMEOUT);

    sessions.set(sessionKey, session);
}

function updateLastAiMessage(sessionKey, messageId) {
    const session = sessions.get(sessionKey);

    if (!session) return;

    session.lastAiMessageId = messageId;

    sessions.set(sessionKey, session);
}

/*
|--------------------------------------------------------------------------
| PROMPT
|--------------------------------------------------------------------------
*/

const buildPrompt = (q, history) => {
    let conversation = "";

    if (history.length > 0) {
        conversation =
            "\n\nPrevious conversation:\n" +
            history
                .map(
                    h =>
                        `${h.role === "user" ? "User" : "AI"}: ${h.content}`
                )
                .join("\n");
    }

    return `You are ADEEL-AI.

LANGUAGE RULES (VERY IMPORTANT):

- If user writes in Urdu script (اردو) -> reply ONLY in proper Urdu script.
- If user writes in Roman Urdu -> reply ONLY in Roman Urdu.
- If user writes in English -> reply ONLY in English.
- Never switch language unless user changes language.
- Always mirror the user's writing style.

GENERAL RULES:

- Remember previous context.
- Be helpful.
- Be concise.
- Be accurate.
- Keep conversational continuity.

${conversation}

User Message:
${q}`;
};

/*
|--------------------------------------------------------------------------
| AI REQUEST
|--------------------------------------------------------------------------
*/

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
        }
    ];

    for (const api of apis) {
        try {
            const res = await axios.get(api.url, {
                timeout: 5000
            });

            const reply = api.extract(res.data);

            if (reply && reply.trim()) {
                return reply.trim();
            }
        } catch {
            continue;
        }
    }

    return null;
};

/*
|--------------------------------------------------------------------------
| MAIN AI COMMAND
|--------------------------------------------------------------------------
*/

cmd({
    pattern: "ai",
    alias: [
        "gpt",
        "gpt4",
        "gpt5",
        "chatgpt",
        "deepseek",
        "openai",
        "adeel",
        "dj"
    ],
    desc: "Chat with AI",
    category: "ai",
    react: "🤖",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) {
            return reply(
                "⚠️ Kuch likho\nMisal:\n.ai Salam kya hal hai"
            );
        }

        const sender = m.sender;
        const sessionKey = getSessionKey(from, sender);

        await conn.sendMessage(from, {
            react: {
                text: "⏳",
                key: mek.key
            }
        });

        if (!localMemory.has(sessionKey)) {
            localMemory.set(sessionKey, []);
        }

        const history = localMemory.get(sessionKey);

        const prompt = buildPrompt(q, history);

        const answer = await aiRequest(prompt);

        if (!answer) {
            await conn.sendMessage(from, {
                react: {
                    text: "❌",
                    key: mek.key
                }
            });

            return reply("❌ AI response failed.");
        }

        history.push({
            role: "user",
            content: q
        });

        history.push({
            role: "ai",
            content: answer
        });

        while (history.length > MAX_HISTORY * 2) {
            history.shift();
        }

        localMemory.set(sessionKey, history);

        const sent = await conn.sendMessage(
            from,
            {
                text: `🤖 ${answer}`
            },
            {
                quoted: m
            }
        );

        startSession(
            sessionKey,
            sent.key.id
        );

        await conn.sendMessage(from, {
            react: {
                text: "✅",
                key: mek.key
            }
        });

    } catch (e) {
        console.log("AI COMMAND ERROR:", e);

        await conn.sendMessage(from, {
            react: {
                text: "❌",
                key: mek.key
            }
        });

        reply("❌ Error occurred.");
    }
});

/*
|--------------------------------------------------------------------------
| AUTO SESSION REPLY
|--------------------------------------------------------------------------
*/

cmd({
    on: "body"
}, async (conn, m, store, {
    from,
    body,
    sender
}) => {
    try {

        if (!body) return;

        if (m.key.fromMe) return;

        if (/^[./!]/.test(body.trim())) return;

        const sessionKey = getSessionKey(
            from,
            sender
        );

        const session = sessions.get(sessionKey);

        if (!session) return;

        const quotedId = getQuotedMessageId(m);

        if (!quotedId) return;

        /*
        IMPORTANT:
        User must reply to the LAST AI message.
        */

        if (
            quotedId !== session.lastAiMessageId
        ) {
            return;
        }

        refreshSession(sessionKey);

        await conn.sendMessage(from, {
            react: {
                text: "⏳",
                key: m.key
            }
        });

        const history =
            localMemory.get(sessionKey) || [];

        const prompt = buildPrompt(
            body.trim(),
            history
        );

        const answer = await aiRequest(prompt);

        if (!answer) {
            await conn.sendMessage(from, {
                react: {
                    text: "❌",
                    key: m.key
                }
            });

            return;
        }

        history.push({
            role: "user",
            content: body.trim()
        });

        history.push({
            role: "ai",
            content: answer
        });

        while (history.length > MAX_HISTORY * 2) {
            history.shift();
        }

        localMemory.set(
            sessionKey,
            history
        );

        const sent =
            await conn.sendMessage(
                from,
                {
                    text: `🤖 ${answer}`
                },
                {
                    quoted: m
                }
            );

        updateLastAiMessage(
            sessionKey,
            sent.key.id
        );

        refreshSession(sessionKey);

        await conn.sendMessage(from, {
            react: {
                text: "✅",
                key: m.key
            }
        });

    } catch (err) {
        console.log(
            "AUTO AI SESSION ERROR:",
            err
        );
    }
});
