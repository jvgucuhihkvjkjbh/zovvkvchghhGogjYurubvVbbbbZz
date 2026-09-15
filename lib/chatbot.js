const fs = require('fs');
const path = require('path');

const STATUS_FILE = path.join(__dirname, '../database/chatbot-status.json');

// In-memory
let chatbotStatus = {};      // { chatId: true/false }
let conversationHistory = {}; // { chatId: [ {role, content}, ... ] }

// Load status from file
function loadStatus() {
    try {
        if (fs.existsSync(STATUS_FILE)) {
            chatbotStatus = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
        }
    } catch (e) {
        chatbotStatus = {};
    }
    return chatbotStatus;
}

function saveStatus() {
    try {
        const dir = path.dirname(STATUS_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(STATUS_FILE, JSON.stringify(chatbotStatus, null, 2));
    } catch (e) {
        console.error('Chatbot status save error:', e.message);
    }
}

function isChatbotOn(chatId) {
    loadStatus();
    return chatbotStatus[chatId] === true;
}

function setChatbot(chatId, status) {
    loadStatus();
    chatbotStatus[chatId] = status;
    saveStatus();
}

// Conversation history (in-memory only)
function getHistory(chatId) {
    if (!conversationHistory[chatId]) conversationHistory[chatId] = [];
    return conversationHistory[chatId];
}

function addToHistory(chatId, role, content) {
    if (!conversationHistory[chatId]) conversationHistory[chatId] = [];
    conversationHistory[chatId].push({ role, content });

    // Last 12 messages only
    if (conversationHistory[chatId].length > 12) {
        conversationHistory[chatId] = conversationHistory[chatId].slice(-12);
    }
}

function clearHistory(chatId) {
    conversationHistory[chatId] = [];
}

module.exports = {
    isChatbotOn,
    setChatbot,
    getHistory,
    addToHistory,
    clearHistory,
    loadStatus
};
