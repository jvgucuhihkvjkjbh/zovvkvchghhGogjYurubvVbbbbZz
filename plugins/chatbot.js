const { cmd } = require('../command');
const axios = require('axios');
const { isSudo } = require('../lib/sudo');
const { isChatbotOn, setChatbot, getHistory, addToHistory, clearHistory, markBotMessage, isBotMessage } = require('../lib/chatbot');

cmd({
    pattern: "chatbot",
    alias: ["cb", "aichat"],
    desc: "Turn chatbot ON/OFF in current chat",
    category: "ai",
    react: "🤖",
    filename: __filename
}, async (conn, mek, m, { from, args, reply, isCreator, sender }) => {
    try {
        if (!isCreator && !isSudo(sender)) {
            return reply("❌ only owner command use");
        }

        const option = (args[0] || '').toLowerCase();

        if (option === 'on') {
            setChatbot(from, true);
            clearHistory(from);
            return reply("✅ *Chatbot ON* ✅\n\nAb main is chat me normal messages ka reply karunga.\nBand karne ke liye: `.chatbot off`");
        }

        if (option === 'off') {
            setChatbot(from, false);
            clearHistory(from);
            return reply("❌ *Chatbot OFF* ❌\n\nAb sirf commands pe kaam karunga.");
        }

        const status = isChatbotOn(from) ? "ON ✅" : "OFF ❌";
        return reply(`🤖 *Chatbot Status:* ${status}\n\n• \`.chatbot on\` - Start AI chat\n• \`.chatbot off\` - Stop AI chat`);

    } catch (e) {
        console.error(e);
        reply("❌ Error: " + e.message);
    }
});

async function handleChatbotMessage(conn, mek, m, { from, body, reply, isCmd }) {
    try {
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

        const sent = await conn.sendMessage(from, { text: aiReply }, { quoted: mek });
        markBotMessage(sent?.key?.id);

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
