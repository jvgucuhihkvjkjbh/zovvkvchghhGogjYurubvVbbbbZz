const { cmd } = require('../command');
const axios = require('axios');
const { isChatbotOn, setChatbot, getHistory, addToHistory, clearHistory } = require('../lib/chatbot');

// ========== COMMAND: chatbot on / off ==========
cmd({
    pattern: "chatbot",
    alias: ["cb", "aichat"],
    desc: "Turn chatbot ON/OFF in current chat",
    category: "ai",
    react: "🤖",
    filename: __filename
}, async (conn, mek, m, { from, args, reply }) => {
    try {
        const option = (args[0] || '').toLowerCase();

        if (option === 'on') {
            setChatbot(from, true);
            clearHistory(from); // naya start
            return reply("✅ *Chatbot ON* ✅\n\nAb main is chat me normal messages ka reply karunga.\nBand karne ke liye: `.chatbot off`");
        }

        if (option === 'off') {
            setChatbot(from, false);
            clearHistory(from);
            return reply("❌ *Chatbot OFF* ❌\n\nAb sirf commands pe kaam karunga.");
        }

        // Status check
        const status = isChatbotOn(from) ? "ON ✅" : "OFF ❌";
        return reply(`🤖 *Chatbot Status:* ${status}\n\n• \`.chatbot on\` - Start AI chat\n• \`.chatbot off\` - Stop AI chat`);

    } catch (e) {
        console.error(e);
        reply("❌ Error: " + e.message);
    }
});

// ========== MESSAGE HANDLER (Chatbot Mode) ==========
// Is function ko aapke main message handler / index.js me call karna hoga
async function handleChatbotMessage(conn, mek, m, { from, body, reply, isCmd }) {
    try {
        // Agar command hai to skip
        if (isCmd) return false;

        // Chatbot is chat me on nahi hai to skip
        if (!isChatbotOn(from)) return false;

        // Empty message skip
        const userMsg = (body || '').trim();
        if (!userMsg) return false;

        // Typing indicator
        await conn.sendPresenceUpdate('composing', from);

        // History lo
        const history = getHistory(from);

        // Context prompt banao
        let contextText = '';
        if (history.length > 0) {
            contextText = history.map(h => `${h.role === 'user' ? 'User' : 'Bot'}: ${h.content}`).join('\n') + '\n';
        }
        contextText += `User: ${userMsg}\nBot:`;

        // System style instruction
        const fullPrompt = `Tum ek casual Pakistani friend ho. Natural Urdu + Roman Urdu me baat karo. Robotic mat bano. Apne aap ko baar baar introduce mat karo. Short aur natural reply do.\n\nConversation:\n${contextText}`;

        // API call
        const apiUrl = `https://adeel-xtech-apis.vercel.app/api/gemini?text=${encodeURIComponent(fullPrompt)}`;
        
        const { data } = await axios.get(apiUrl, {
            timeout: 35000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        let aiReply = data?.result || data?.response || "Samajh nahi aya, thori der baad try karo.";

        // History me save karo
        addToHistory(from, 'user', userMsg);
        addToHistory(from, 'bot', aiReply);

        // Reply bhejo
        await conn.sendMessage(from, { text: aiReply }, { quoted: mek });

        await conn.sendPresenceUpdate('paused', from);
        return true; // handled

    } catch (e) {
        console.error('Chatbot handler error:', e.message);
        return false;
    }
}

module.exports = {
    handleChatbotMessage
};
