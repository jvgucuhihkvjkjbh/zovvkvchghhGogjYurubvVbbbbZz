const { cmd } = require("../command");

cmd({
    on: "body",
    react: "📤",
    filename: __filename
}, async (client, message, match, { isOwner }) => {

    if (!message.quoted) return;

    const raw = message.body.trim();
    
    const prefix = process.env.PREFIX || ".";
    
    let text = raw;
    if (raw.startsWith(prefix)) {
        text = raw.slice(prefix.length).trim().toLowerCase();
    } else {
        text = raw.trim().toLowerCase();
    }

    const sendTriggers = ["send", "send me", "send kr", "send krna"];
    const saveTriggers = ["save", "sv", "❤", "🤍"];

    if (isOwner && saveTriggers.includes(text)) {

        const buffer = await message.quoted.download();
        const mtype = message.quoted.mtype;
        const selfJid = message.sender;

        let content = {};

        if (mtype === "imageMessage") {
            content = { image: buffer, caption: message.quoted.text || "" };
        } else if (mtype === "videoMessage") {
            content = { video: buffer, caption: message.quoted.text || "" };
        } else if (mtype === "audioMessage") {
            content = { audio: buffer, mimetype: "audio/mp4", ptt: message.quoted.ptt || false };
        } else {
            content = { text: message.quoted.text || "" };
        }

        await client.sendMessage(selfJid, content);
        return;
    }

    if (sendTriggers.includes(text)) {

        const buffer = await message.quoted.download();
        const mtype = message.quoted.mtype;

        let content = {};

        if (mtype === "imageMessage") {
            content = { image: buffer, caption: message.quoted.text || "" };
        } else if (mtype === "videoMessage") {
            content = { video: buffer, caption: message.quoted.text || "" };
        } else if (mtype === "audioMessage") {
            content = { audio: buffer, mimetype: "audio/mp4", ptt: message.quoted.ptt || false };
        } else {
            content = { text: message.quoted.text || "" };
        }

        await client.sendMessage(message.chat, content, { quoted: message });
    }

});