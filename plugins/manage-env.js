const { cmd, commands } = require('../command');
const config = require('../config');
const prefix = config.PREFIX;
const fs = require('fs');
const { getBuffer, getGroupAdmins, getRandom, h2k, isUrl, Json, sleep, fetchJson } = require('../lib/functions2');
const { writeFileSync } = require('fs');
const path = require('path');

const OWNER_PATH = path.join(__dirname, "../lib/sudo.json");

const loadSudo = () => {
    try {
        return JSON.parse(fs.readFileSync(OWNER_PATH, "utf-8"));
    } catch {
        return [];
    }
};

const isAuthorized = (sender, isCreator) => {
    if (isCreator) return true;
    
    const sudoOwners = loadSudo();
    
    return sudoOwners.some(owner => owner === sender);
};

// --- AUTOVOICE COMMAND ---
cmd({
    pattern: "autovoice",
    alias: ["voiceauto", "av"],
    description: "Enable or Disable Auto-Voice feature permanently.",
    category: "settings",
    filename: __filename
},    
async (conn, mek, m, { args, isCreator, reply, sender }) => {
    if (!isAuthorized(sender, isCreator)) {
        return reply("*📛 ᴏɴʟʏ ᴛʜᴇ ᴏᴡɴᴇʀ ᴀɴᴅ ᴀʟʟᴏᴡᴇᴅ ʟɪᴅ ᴄᴀɴ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ!*");
    }

    const status = args[0]?.toLowerCase();
    if (status === "on") {
        config.AUTO_VOICE = "true";
        global.autoVoiceStatus = "true";
        return reply("✅ *ᴀᴜᴛᴏ-ᴠᴏɪᴄᴇ ғᴇᴀᴛᴜʀᴇ ɪs ɴᴏᴡ ᴇɴᴀʙʟᴇᴅ.*");
    } else if (status === "off") {
        config.AUTO_VOICE = "false";
        global.autoVoiceStatus = "false";
        return reply("❌ *ᴀᴜᴛᴏ-ᴠᴏɪᴄᴇ ғᴇᴀᴛᴜʀᴇ ɪs ɴᴏᴡ ᴅɪsᴀʙʟᴇᴅ.*");
    } else {
        return reply(`_Example: .autovoice on_`);
    }
});

// --- ADMIN EVENTS ---
cmd({
    pattern: "admin-events",
    alias: ["adminevents"],
    desc: "Enable or disable admin event notifications",
    category: "settings",
    filename: __filename
},
async (conn, mek, m, { from, args, isCreator, reply, sender }) => {
    if (!isAuthorized(sender, isCreator)) {
        return reply("*📛 ᴏɴʟʏ ᴛʜᴇ ᴏᴡɴᴇʀ ᴀɴᴅ ᴀʟʟᴏᴡᴇᴅ ʟɪᴅ ᴄᴀɴ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ!*");
    }

    const status = args[0]?.toLowerCase();
    if (status === "on") {
        config.ADMIN_EVENTS = "true";
        return reply("✅ Admin event notifications are now enabled.");
    } else if (status === "off") {
        config.ADMIN_EVENTS = "false";
        return reply("❌ Admin event notifications are now disabled.");
    } else {
        return reply(`Example: .admin-events on`);
    }
});

// --- WELCOME ---
cmd({
    pattern: "welcome",
    alias: ["welcomeset"],
    desc: "Enable or disable welcome messages for new members",
    category: "settings",
    filename: __filename
},
async (conn, mek, m, { from, args, isCreator, reply, sender }) => {
    if (!isAuthorized(sender, isCreator)) {
        return reply("*📛 ᴏɴʟʏ ᴛʜᴇ ᴏᴡɴᴇʀ ᴀɴᴅ ᴀʟʟᴏᴡᴇᴅ ʟɪᴅ ᴄᴀɴ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ!*");
    }

    const status = args[0]?.toLowerCase();
    if (status === "on") {
        config.WELCOME = "true";
        return reply("✅ Welcome messages are now enabled.");
    } else if (status === "off") {
        config.WELCOME = "false";
        return reply("❌ Welcome messages are now disabled.");
    } else {
        return reply(`Example: .welcome on`);
    }
});

// --- SETPREFIX ---
cmd({
    pattern: "setprefix",
    alias: ["prefix"],
    react: "🔧",
    desc: "Change the bot's command prefix.",
    category: "settings",
    filename: __filename,
}, async (conn, mek, m, { from, args, isCreator, reply, sender }) => {
    if (!isAuthorized(sender, isCreator)) {
        return reply("*📛 ᴏɴʟʏ ᴛʜᴇ ᴏᴡɴᴇʀ ᴀɴᴅ ᴀʟʟᴏᴡᴇᴅ ʟɪᴅ ᴄᴀɴ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ!*");
    }

    const newPrefix = args[0];
    if (!newPrefix) return reply("❌ Please provide a new prefix. Example: `.setprefix !`");

    config.PREFIX = newPrefix;
    return reply(`✅ Prefix successfully changed to *${newPrefix}*`);
});

// --- MODE ---
cmd({
    pattern: "mode",
    alias: ["setmode"],
    react: "🫟",
    desc: "Set bot mode to private or public.",
    category: "settings",
    filename: __filename,
}, async (conn, mek, m, { from, args, isCreator, reply, sender }) => {
    if (!isAuthorized(sender, isCreator)) {
        return reply("*📛 ᴏɴʟʏ ᴛʜᴇ ᴏᴡɴᴇʀ ᴀɴᴅ ᴀʟʟᴏᴡᴇᴅ ʟɪᴅ ᴄᴀɴ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ!*");
    }

    if (!args[0]) {
        return reply(`📌 Current mode: *${config.MODE}*\n\nUsage: .mode private OR .mode public`);
    }

    const modeArg = args[0].toLowerCase();
    if (modeArg === "private") {
        config.MODE = "private";
        return reply("✅ Bot mode is now set to *PRIVATE*.");
    } else if (modeArg === "public") {
        config.MODE = "public";
        return reply("✅ Bot mode is now set to *PUBLIC*.");
    } else {
        return reply("❌ Invalid mode. Please use `.mode private` or `.mode public`.");
    }
});

// --- AUTO TYPING ---
cmd({
    pattern: "auto-typing",
    description: "Enable or disable auto-typing feature.",
    category: "settings",
    filename: __filename
},    
async (conn, mek, m, { from, args, isCreator, reply, sender }) => {
    if (!isAuthorized(sender, isCreator)) {
        return reply("*📛 ᴏɴʟʏ ᴛʜᴇ ᴏᴡɴᴇʀ ᴀɴᴅ ᴀʟʟᴏᴡᴇᴅ ʟɪᴅ ᴄᴀɴ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ!*");
    }

    const status = args[0]?.toLowerCase();
    if (!["on", "off"].includes(status)) {
        return reply("*🫟 ᴇxᴀᴍᴘʟᴇ:  .ᴀᴜᴛᴏ-ᴛʏᴘɪɴɢ ᴏɴ*");
    }

    config.AUTO_TYPING = status === "on" ? "true" : "false";
    return reply(`Auto typing has been turned ${status}.`);
});

// --- MENTION REPLY ---
cmd({
    pattern: "mention-reply",
    alias: ["menetionreply", "mee"],
    description: "Enable or disable mention reply feature.",
    category: "settings",
    filename: __filename
},    
async (conn, mek, m, { from, args, isCreator, reply, sender }) => {
    if (!isAuthorized(sender, isCreator)) {
        return reply("*📛 ᴏɴʟʏ ᴛʜᴇ ᴏᴡɴᴇʀ ᴀɴᴅ ᴀʟʟᴏᴡᴇᴅ ʟɪᴅ ᴄᴀɴ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ!*");
    }

    if (args[0] === "on") {
        config.MENTION_REPLY = "true";
        return reply("Mention Reply feature is now enabled.");
    } else if (args[0] === "off") {
        config.MENTION_REPLY = "false";
        return reply("Mention Reply feature is now disabled.");
    } else {
        return reply(`_example:  .mee on_`);
    }
});

// --- ALWAYS ONLINE ---
cmd({
    pattern: "always-online",
    alias: ["alwaysonline"],
    desc: "Enable or disable the always online mode",
    category: "settings",
    filename: __filename
},
async (conn, mek, m, { from, args, isCreator, reply, sender }) => {

    if (!isAuthorized(sender, isCreator)) {
        return reply("*📛 ᴏɴʟʏ ᴛʜᴇ ᴏᴡɴᴇʀ ᴀɴᴅ ᴀʟʟᴏᴡᴇᴅ ᴜsᴇʀ ᴄᴀɴ ᴜsᴇ ᴛʜɪs!*");
    }

    const status = args[0]?.toLowerCase();

    if (status === "on") {
        config.ALWAYS_ONLINE = "true";
        global.alwaysOnline = true;

        await conn.sendPresenceUpdate('available');
        await reply("*✅ always online mode is now enabled.*");

    } else if (status === "off") {
        config.ALWAYS_ONLINE = "false";
        global.alwaysOnline = false;

        await conn.sendPresenceUpdate('unavailable');
        await reply("*❌ always online mode is now disabled.*");

    } else {
        const current = global.alwaysOnline ? "✅ ON" : "❌ OFF";
        await reply(`*🌐 Always Online: ${current}*\n\n*🛠️ ᴇxᴀᴍᴘʟᴇ: .ᴀʟᴡᴀʏs-ᴏɴʟɪɴᴇ ᴏɴ*`);
    }
});

// --- AUTO RECORDING ---
cmd({
    pattern: "auto-recording",
    alias: ["autorecoding"],
    description: "Enable or disable auto-recording feature.",
    category: "settings",
    filename: __filename
},    
async (conn, mek, m, { from, args, isCreator, reply, sender }) => {
    if (!isAuthorized(sender, isCreator)) {
        return reply("*📛 ᴏɴʟʏ ᴛʜᴇ ᴏᴡɴᴇʀ ᴀɴᴅ ᴀʟʟᴏᴡᴇᴅ ʟɪᴅ ᴄᴀɴ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ!*");
    }

    const status = args[0]?.toLowerCase();
    if (!["on", "off"].includes(status)) {
        return reply("*🫟 ᴇxᴀᴍᴘʟᴇ: .ᴀᴜᴛᴏ-ʀᴇᴄᴏʀᴅɪɴɢ ᴏɴ*");
    }

    config.AUTO_RECORDING = status === "on" ? "true" : "false";
    if (status === "on") {
        await conn.sendPresenceUpdate("recording", from);
        return reply("Auto recording is now enabled.");
    } else {
        await conn.sendPresenceUpdate("available", from);
        return reply("Auto recording has been disabled.");
    }
});

// --- AUTO SEEN ---
cmd({
    pattern: "auto-seen",
    alias: ["autostatusview"],
    desc: "Enable or disable auto-viewing of statuses",
    category: "settings",
    filename: __filename
},    
async (conn, mek, m, { from, args, isCreator, reply, sender }) => {
    if (!isAuthorized(sender, isCreator)) {
        return reply("*📛 ᴏɴʟʏ ᴛʜᴇ ᴏᴡɴᴇʀ ᴀɴᴅ ᴀʟʟᴏᴡᴇᴅ ʟɪᴅ ᴄᴀɴ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ!*");
    }

    if (args[0] === "on") {
        config.AUTO_STATUS_SEEN = "true";
        return reply("Auto-viewing of statuses is now enabled.");
    } else if (args[0] === "off") {
        config.AUTO_STATUS_SEEN = "false";
        return reply("Auto-viewing of statuses is now disabled.");
    } else {
        return reply(`*🫟 ᴇxᴀᴍᴘʟᴇ:  .ᴀᴜᴛᴏ-sᴇᴇɴ ᴏɴ*`);
    }
}); 

// --- STATUS REACT ---
cmd({
    pattern: "status-react",
    alias: ["statusreaction"],
    desc: "Enable or disable auto-liking of statuses",
    category: "settings",
    filename: __filename
},    
async (conn, mek, m, { from, args, isCreator, reply, sender }) => {
    if (!isAuthorized(sender, isCreator)) {
        return reply("*📛 ᴏɴʟʏ ᴛʜᴇ ᴏᴡɴᴇʀ ᴀɴᴅ ᴀʟʟᴏᴡᴇᴅ ʟɪᴅ ᴄᴀɴ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ!*");
    }

    if (args[0] === "on") {
        config.AUTO_STATUS_REACT = "true";
        return reply("Auto-liking of statuses is now enabled.");
    } else if (args[0] === "off") {
        config.AUTO_STATUS_REACT = "false";
        return reply("Auto-liking of statuses is now disabled.");
    } else {
        return reply(`Example: .status-react on`);
    }
});

// --- READ MESSAGE ---
cmd({
    pattern: "read-message",
    alias: ["autoread"],
    desc: "enable or disable readmessage.",
    category: "settings",
    filename: __filename
},    
async (conn, mek, m, { from, args, isCreator, reply, sender }) => {
    if (!isAuthorized(sender, isCreator)) {
        return reply("*📛 ᴏɴʟʏ ᴛʜᴇ ᴏᴡɴᴇʀ ᴀɴᴅ ᴀʟʟᴏᴡᴇᴅ ʟɪᴅ ᴄᴀɴ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ!*");
    }

    if (args[0] === "on") {
        config.READ_MESSAGE = "true";
        return reply("readmessage feature is now enabled.");
    } else if (args[0] === "off") {
        config.READ_MESSAGE = "false";
        return reply("readmessage feature is now disabled.");
    } else {
        return reply(`_example:  .readmessage on_`);
    }
});

// --- ANTI BAD ---
cmd({
    pattern: "anti-bad",
    alias: ["antibadword"],
    desc: "enable or disable antibad.",
    category: "settings",
    filename: __filename
},    
async (conn, mek, m, { from, args, isCreator, reply, sender }) => {
    if (!isAuthorized(sender, isCreator)) {
        return reply("*📛 ᴏɴʟʏ ᴛʜᴇ ᴏᴡɴᴇʀ ᴀɴᴅ ᴀʟʟᴏᴡᴇᴅ ʟɪᴅ ᴄᴀɴ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ!*");
    }

    if (args[0] === "on") {
        config.ANTI_BAD = "true";
        return reply("*anti bad word is now enabled.*");
    } else if (args[0] === "off") {
        config.ANTI_BAD = "false";
        return reply("*anti bad word feature is now disabled*");
    } else {
        return reply(`_example:  .antibad on_`);
    }
});

// --- AUTO STICKER ---
cmd({
    pattern: "auto-sticker",
    alias: ["autosticker"],
    desc: "enable or disable auto-sticker.",
    category: "settings",
    filename: __filename
},    
async (conn, mek, m, { from, args, isCreator, reply, sender }) => {
    if (!isAuthorized(sender, isCreator)) {
        return reply("*📛 ᴏɴʟʏ ᴛʜᴇ ᴏᴡɴᴇʀ ᴀɴᴅ ᴀʟʟᴏᴡᴇᴅ ʟɪᴅ ᴄᴀɴ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ!*");
    }

    if (args[0] === "on") {
        config.AUTO_STICKER = "true";
        return reply("auto-sticker feature is now enabled.");
    } else if (args[0] === "off") {
        config.AUTO_STICKER = "false";
        return reply("auto-sticker feature is now disabled.");
    } else {
        return reply(`_example:  .auto-sticker on_`);
    }
});

// --- AUTO REPLY ---
cmd({
    pattern: "auto-reply",
    alias: ["autoreply"],
    desc: "enable or disable auto-reply.",
    category: "settings",
    filename: __filename
},    
async (conn, mek, m, { from, args, isCreator, reply, sender }) => {
    if (!isAuthorized(sender, isCreator)) {
        return reply("*📛 ᴏɴʟʏ ᴛʜᴇ ᴏᴡɴᴇʀ ᴀɴᴅ ᴀʟʟᴏᴡᴇᴅ ʟɪᴅ ᴄᴀɴ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ!*");
    }

    if (args[0] === "on") {
        config.AUTO_REPLY = "true";
        return reply("*auto-reply is now enabled.*");
    } else if (args[0] === "off") {
        config.AUTO_REPLY = "false";
        return reply("auto-reply feature is now disabled.");
    } else {
        return reply(`*🫟 ᴇxᴀᴍᴘʟᴇ: .auto-reply on*`);
    }
});

// --- AUTO REACT ---
cmd({
    pattern: "auto-react",
    alias: ["autoreact"],
    desc: "Enable or disable the autoreact feature",
    category: "settings",
    filename: __filename
},    
async (conn, mek, m, { from, args, isCreator, reply, sender }) => {
    if (!isAuthorized(sender, isCreator)) {
        return reply("*📛 ᴏɴʟʏ ᴛʜᴇ ᴏᴡɴᴇʀ ᴀɴᴅ ᴀʟʟᴏᴡᴇᴅ ʟɪᴅ ᴄᴀɴ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ!*");
    }

    if (args[0] === "on") {
        config.AUTO_REACT = "true";
        await reply("*autoreact feature is now enabled.*");
    } else if (args[0] === "off") {
        config.AUTO_REACT = "false";
        await reply("autoreact feature is now disabled.");
    } else {
        await reply(`*🫟 ᴇxᴀᴍᴘʟᴇ: .auto-react on*`);
    }
});

// --- ANTI CALL ---
cmd({
    pattern: "anti-call",
    alias: ["anticall"],
    desc: "Enable or disable the anticall feature",
    category: "settings",
    filename: __filename
},    
async (conn, mek, m, { from, args, isCreator, reply, sender }) => {
    if (!isAuthorized(sender, isCreator)) {
        return reply("*📛 ᴏɴʟʏ ᴛʜᴇ ᴏᴡɴᴇʀ ᴀɴᴅ ᴀʟʟᴏᴡᴇᴅ ʟɪᴅ ᴄᴀɴ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ!*");
    }

    if (args[0] === "on") {
        config.ANTI_CALL = "true";
        await reply("*anticall feature is now enabled.*");
    } else if (args[0] === "off") {
        config.ANTI_CALL = "false";
        await reply("anticall feature is now disabled.");
    } else {
        await reply(`*🛠️ ᴇxᴀᴍᴘʟᴇ: .anti-call on*`);
    }
});

// --- STATUS REPLY ---
cmd({
    pattern: "status-reply",
    alias: ["autostatusreply"],
    desc: "enable or disable status-reply.",
    category: "settings",
    filename: __filename
},    
async (conn, mek, m, { from, args, isCreator, reply, sender }) => {
    if (!isAuthorized(sender, isCreator)) {
        return reply("*📛 ᴏɴʟʏ ᴛʜᴇ ᴏᴡɴᴇʀ ᴀɴᴅ ᴀʟʟᴏᴡᴇᴅ ʟɪᴅ ᴄᴀɴ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ!*");
    }

    if (args[0] === "on") {
        config.AUTO_STATUS_REPLY = "true";
        return reply("status-reply feature is now enabled.");
    } else if (args[0] === "off") {
        config.AUTO_STATUS_REPLY = "false";
        return reply("status-reply feature is now disabled.");
    } else {
        return reply(`*🫟 ᴇxᴀᴍᴘʟᴇ: .status-reply on*`);
    }
});

// --- ANTILINK ---
cmd({
    pattern: "antilink",
    alias: ["antilinks"],
    desc: "enable or disable antilink.",
    category: "settings",
    filename: __filename
},
async (conn, mek, m, { args, isCreator, reply, sender }) => {
    if (!isAuthorized(sender, isCreator)) {
        return reply("*📛 ᴏɴʟʏ ᴛʜᴇ ᴏᴡɴᴇʀ ᴀɴᴅ ᴀʟʟᴏᴡᴇᴅ ʟɪᴅ ᴄᴀɴ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ!*");
    }

    if (!args[0])
        return reply("_example: .antilink on / off_");

    if (args[0].toLowerCase() === "on") {
        config.ANTI_LINK = true;
        return reply("*✅ Anti link enabled.*");
    }

    if (args[0].toLowerCase() === "off") {
        config.ANTI_LINK = false;
        return reply("*❌ Anti link disabled.*");
    }

    reply("_example: .antilink on / off_");
});

// --- ANTILINK KICK ---
cmd({
    pattern: "antilinkkick",
    alias: ["kicklink"],
    desc: "enable or disable antilink kick.",
    category: "settings",
    filename: __filename
},
async (conn, mek, m, { args, isCreator, reply, sender }) => {
    if (!isAuthorized(sender, isCreator)) {
        return reply("*📛 ᴏɴʟʏ ᴛʜᴇ ᴏᴡɴᴇʀ ᴀɴᴅ ᴀʟʟᴏᴡᴇᴅ ʟɪᴅ ᴄᴀɴ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ!*");
    }

    if (!args[0])
        return reply("_example: .antilinkkick on / off_");

    if (args[0].toLowerCase() === "on") {
        config.ANTI_LINK_KICK = true;
        return reply("*✅ Anti link kick enabled.*");
    }

    if (args[0].toLowerCase() === "off") {
        config.ANTI_LINK_KICK = false;
        return reply("*❌ Anti link kick disabled.*");
    }

    reply("_example: .antilinkkick on / off_");
});

// --- DELETE LINK ---
cmd({
    pattern: "delete-link",
    alias: ["deletelink", "linksdelete"],
    desc: "enable or disable delete link.",
    category: "settings",
    filename: __filename
},
async (conn, mek, m, { args, isCreator, reply, sender }) => {
    if (!isAuthorized(sender, isCreator)) {
        return reply("*📛 ᴏɴʟʏ ᴛʜᴇ ᴏᴡɴᴇʀ ᴀɴᴅ ᴀʟʟᴏᴡᴇᴅ ʟɪᴅ ᴄᴀɴ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ!*");
    }

    if (!args[0])
        return reply("_example: .deletelink on / off_");

    if (args[0].toLowerCase() === "on") {
        config.DELETE_LINKS = true;
        return reply("*✅ Delete link enabled.*");
    }

    if (args[0].toLowerCase() === "off") {
        config.DELETE_LINKS = false;
        return reply("*❌ Delete link disabled.*");
    }

    reply("_example: .deletelink on / off_");
});

// --- CUSTOM REACT COMMAND ---
cmd({
    pattern: "customreact",
    alias: ["custom-react"],
    react: "🎭",
    desc: "Enable or disable custom reactions",
    category: "settings",
    filename: __filename
},
async (conn, mek, m, { from, args, isCreator, reply, sender }) => {
    if (!isAuthorized(sender, isCreator)) {
        return reply("*📛 ᴏɴʟʏ ᴛʜᴇ ᴏᴡɴᴇʀ ᴀɴᴅ ᴀʟʟᴏᴡᴇᴅ ʟɪᴅ ᴄᴀɴ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ!*");
    }

    const status = args[0]?.toLowerCase();
    
    if (status === "on") {
        config.CUSTOM_REACT = "true";
        return reply("*ᴄᴜsᴛᴏᴍ ʀᴇᴀᴄᴛɪᴏɴs ᴀʀᴇ ɴᴏᴡ ᴇɴᴀʙʟᴇᴅ*");
    } 
    else if (status === "off") {
        config.CUSTOM_REACT = "false";
        return reply("*ᴄᴜsᴛᴏᴍ ʀᴇᴀᴄᴛɪᴏɴs ᴀʀᴇ ɴᴏᴡ ᴅɪsᴀʙʟᴇᴅ*");
    } 
    else {
        return reply("🎭 *Usage:* .customreact on / off");
    }
});

// --- ANTI DELETE ---
cmd({
    pattern: "antidelete",
    alias: ["antidel", "adel"],
    react: "🗑️",
    desc: "Enable or disable anti-delete feature.",
    category: "settings",
    filename: __filename
},
async (conn, mek, m, { from, args, isCreator, reply, sender }) => {
    if (!isAuthorized(sender, isCreator)) {
        return reply("*📛 ᴏɴʟʏ ᴛʜᴇ ᴏᴡɴᴇʀ ᴀɴᴅ ᴀʟʟᴏᴡᴇᴅ ʟɪᴅ ᴄᴀɴ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ!*");
    }

    const status = args[0]?.toLowerCase();

    if (status === "on") {
        config.ANTI_DELETE = "true";
        return reply("*✅ antidelete feature is now enabled.*");
    } else if (status === "off") {
        config.ANTI_DELETE = "false";
        return reply("*❌ antidelete feature is now disabled.*");
    } else if (status === "inbox") {
        config.ANTI_DEL_PATH = "inbox";
        return reply("*📥 antidelete path set to inbox (owner).*");
    } else if (status === "same") {
        config.ANTI_DEL_PATH = "same";
        return reply("*💬 antidelete path set to same chat.*");
    } else {
        return reply("*🫟 ᴇxᴀᴍᴘʟᴇ: .antidelete on / off / inbox / same*");
    }
});