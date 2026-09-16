const { cmd } = require('../command');
const axios = require('axios');
const { isSudo } = require('../lib/sudo');
const {
    isChatbotOn,
    setChatbot,
    isGlobalChatsOn,
    setGlobalChats,
    isGlobalGroupsOn,
    setGlobalGroups,
    getHistory,
    addToHistory,
    clearHistory,
    isBotMessage,
    wrapConnSend
} = require('../lib/chatbot');

cmd({
    pattern: "chatbot",
    alias: ["cb", "aichat"],
    desc: "Turn chatbot ON/OFF in current chat, all chats, or all groups",
    category: "ai",
    react: "🤖",
    filename: __filename
}, async (conn, mek, m, { from, args, reply, isCreator, sender }) => {
    try {
        if (!isCreator && !isSudo(sender)) {
            return reply("❌ only owner command use");
        }

        const option = (args[0] || '').toLowerCase();
        const scope = (args[1] || '').toLowerCase();

        if (option === 'on' && scope === 'chat') {
            setGlobalChats(true);
            return reply("✅ Chatbot ON for all chats");
        }

        if (option === 'off' && scope === 'chat') {
            setGlobalChats(false);
            return reply("❌ Chatbot OFF for all chats");
        }

        if (option === 'on' && (scope === 'group' || scope === 'groups')) {
            setGlobalGroups(true);
            return reply("✅ Chatbot ON for all groups");
        }

        if (option === 'off' && (scope === 'group' || scope === 'groups')) {
            setGlobalGroups(false);
            return reply("❌ Chatbot OFF for all groups");
        }

        if (option === 'on') {
            setChatbot(from, true);
            clearHistory(from);
            return reply("✅ Chatbot ON");
        }

        if (option === 'off') {
            setChatbot(from, false);
            clearHistory(from);
            return reply("❌ Chatbot OFF");
        }

        const status = isChatbotOn(from) ? "ON" : "OFF";
        const chatsStatus = isGlobalChatsOn() ? "ON" : "OFF";
        const groupsStatus = isGlobalGroupsOn() ? "ON" : "OFF";
        return reply(`This chat: ${status}\nAll chats: ${chatsStatus}\nAll groups: ${groupsStatus}`);

    } catch (e) {
        console.error(e);
        reply("❌ Error: " + e.message);
    }
});

async function handleChatbotMessage(conn, mek, m, { from, body, reply, isCmd }) {
    try {
        wrapConnSend(conn);

        if (isCmd) return false;
        if (isBotMessage(mek?.key?.id)) return false;
        if (!isChatbotOn(from)) return false;

        const userMsg = (body || '').trim();
        if (!userMsg) return false;

        await conn.sendPresenceUpdate('composing', from);

        const history = getHistory(from);
        let contextText = '';
        if (history.length > 0) {
            contextText = history.map(h => `${h.role === 'user' ? 'User' : 'Bot'}: ${h.content}`).join('\n') + '\n';
        }
        contextText += `User: ${userMsg}\nBot:`;

        const fullPrompt = `Tum ek casual Pakistani friend ho. Natural Urdu + Roman Urdu me baat karo. Robotic mat bano. Apne aap ko baar baar introduce mat karo. Short aur natural reply do.\n\nConversation:\n${contextText}`;

        const apiUrl = `https://adeel-xtech-apis.vercel.app/api/gpt?q=${encodeURIComponent(fullPrompt)}`;

        const { data } = await axios.get(apiUrl, {
            timeout: 35000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        let aiReply = data?.result || data?.response || "Samajh nahi aya, thori der baad try karo.";

        addToHistory(from, 'user', userMsg);
        addToHistory(from, 'bot', aiReply);

        await conn.sendMessage(from, { text: aiReply }, { quoted: mek });

        await conn.sendPresenceUpdate('paused', from);
        return true;

    } catch (e) {
        console.error('Chatbot handler error:', e.message);
        return false;
    }
}

module.exports = {
    handleChatbotMessage
};
