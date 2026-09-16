const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'database/chatbot-data.json');

let chatbotStatus = {};
let conversationHistory = {};
let globalChats = false;
let globalGroups = false;
let botSentMessageIds = new Set();

function ensureDir(filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            chatbotStatus = parsed.status || {};
            conversationHistory = parsed.history || {};
            globalChats = parsed.globalChats === true;
            globalGroups = parsed.globalGroups === true;
        }
    } catch (e) {
        chatbotStatus = {};
        conversationHistory = {};
        globalChats = false;
        globalGroups = false;
    }
}

function saveData() {
    try {
        ensureDir(DATA_FILE);
        const data = {
            status: chatbotStatus,
            history: conversationHistory,
            globalChats,
            globalGroups
        };
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Chatbot data save error:', e.message);
    }
}

loadData();

function isGroupChat(chatId) {
    return typeof chatId === 'string' && chatId.endsWith('@g.us');
}

function isChatbotOn(chatId) {
    if (isGroupChat(chatId)) {
        if (globalGroups) return true;
    } else {
        if (globalChats) return true;
    }
    return chatbotStatus[chatId] === true;
}

function setChatbot(chatId, status) {
    chatbotStatus[chatId] = status;
    saveData();
}

function isGlobalChatsOn() {
    return globalChats;
}

function setGlobalChats(status) {
    globalChats = status;
    saveData();
}

function isGlobalGroupsOn() {
    return globalGroups;
}

function setGlobalGroups(status) {
    globalGroups = status;
    saveData();
}

function getHistory(chatId) {
    if (!conversationHistory[chatId]) conversationHistory[chatId] = [];
    return conversationHistory[chatId];
}

function addToHistory(chatId, role, content) {
    if (!conversationHistory[chatId]) conversationHistory[chatId] = [];
    conversationHistory[chatId].push({ role, content });

    if (conversationHistory[chatId].length > 12) {
        conversationHistory[chatId] = conversationHistory[chatId].slice(-12);
    }
    saveData();
}

function clearHistory(chatId) {
    conversationHistory[chatId] = [];
    saveData();
}

function markBotMessage(id) {
    if (!id) return;
    botSentMessageIds.add(id);
    if (botSentMessageIds.size > 200) {
        const first = botSentMessageIds.values().next().value;
        botSentMessageIds.delete(first);
    }
}

function isBotMessage(id) {
    return id ? botSentMessageIds.has(id) : false;
}

function wrapConnSend(conn) {
    if (conn.__chatbotSendWrapped) return;
    conn.__chatbotSendWrapped = true;

    const originalSend = conn.sendMessage.bind(conn);
    conn.sendMessage = async (...args) => {
        const sent = await originalSend(...args);
        if (sent?.key?.id) markBotMessage(sent.key.id);
        return sent;
    };
}

module.exports = {
    isChatbotOn,
    setChatbot,
    isGlobalChatsOn,
    setGlobalChats,
    isGlobalGroupsOn,
    setGlobalGroups,
    getHistory,
    addToHistory,
    clearHistory,
    markBotMessage,
    isBotMessage,
    wrapConnSend
};
