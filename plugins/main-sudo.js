const { cmd } = require("../command");
const { loadSudo, saveSudo } = require("../lib/sudo");

const normalizeTarget = (input) => {
    if (!input) return null;
    input = String(input).trim();

    if (input.includes("@lid")) {
        return input;
    }

    if (input.includes("@s.whatsapp.net")) {
        const beforeAt = input.split("@")[0].replace(/\D/g, "");
        if (beforeAt.length >= 10) {
            let num = beforeAt;
            if (num.startsWith("0") && num.length === 11) {
                num = "92" + num.slice(1);
            }
            return num + "@s.whatsapp.net";
        }
        return null;
    }

    let number = input.replace(/\D/g, "");

    if (!number || number.length < 10) return null;

    if (number.startsWith("0") && number.length === 11) {
        number = "92" + number.slice(1);
    }

    if (number.length === 10 && number.startsWith("3")) {
        number = "92" + number;
    }

    if (number.startsWith("92") && number.length >= 12) {
        return number + "@s.whatsapp.net";
    }

    return null;
};

cmd({
    pattern: "setsudo",
    alias: ["addsudo", "addowner"],
    desc: "Add a temporary owner",
    category: "owner",
    react: "💋",
    filename: __filename
}, async (conn, mek, m, { from, args, isCreator, reply }) => {
    try {
        if (!isCreator) return reply("❗ *𝚃𝙷𝙸𝚂 𝙲𝙾𝙼𝙼𝙰𝙽𝙳 𝙲𝙰𝙽 𝙾𝙽𝙻𝚈 𝙱𝙴 𝚄𝚂𝙴𝙳 𝙱𝚈 𝙼𝚈 𝙾𝚆𝙽𝙴𝚁*");

        let target = m.mentionedJid?.[0]
                || m.quoted?.sender
                || (args[0] ? normalizeTarget(args[0]) : null);

        if (!target) return reply("❌ *𝙿𝙻𝙴𝙰𝚂𝙴 𝙿𝚁𝙾𝚅𝙸𝙳𝙴 𝙰 𝚅𝙰𝙻𝙸𝙳 𝙽𝚄𝙼𝙱𝙴𝚁/𝙻𝙸𝙳 𝙾𝚁 𝚃𝙰𝙶/𝚁𝙴𝙿𝙻𝚈 𝙰 𝚄𝚂𝙴𝚁*");

        let owners = loadSudo();
        if (owners.includes(target)) return reply("❌ *𝚃𝙷𝙸𝚂 𝚄𝚂𝙴𝚁 𝙸𝚂 𝙰𝙻𝚁𝙴𝙰𝙳𝚈 𝙰 𝚃𝙴𝙼𝙿𝙾𝚁𝙰𝚁𝚈 𝙾𝚆𝙽𝙴𝚁*");

        owners.push(target);
        saveSudo(owners);

        await conn.sendMessage(from, {
            image: { url: "https://files.catbox.moe/h49t5f.jpg" },
            caption: "✅ *𝚂𝚄𝙲𝙲𝙴𝚂𝚂𝙵𝚄𝙻𝙻𝚈 𝙰𝙳𝙳𝙴𝙳 𝚄𝚂𝙴𝚁 𝙰𝚂 𝚃𝙴𝙼𝙿𝙾𝚁𝙰𝚁𝚈 𝙾𝚆𝙽𝙴𝚁*"
        }, { quoted: mek });

    } catch (err) {
        console.error(err);
        reply("❌ Error: " + err.message);
    }
});

cmd({
    pattern: "delsudo",
    alias: ["delowner", "deletesudo"],
    desc: "Remove a temporary owner",
    category: "owner",
    react: "🫩",
    filename: __filename
}, async (conn, mek, m, { from, args, isCreator, reply }) => {
    try {
        if (!isCreator) return reply("❗ *𝚃𝙷𝙸𝚂 𝙲𝙾𝙼𝙼𝙰𝙽𝙳 𝙲𝙰𝙽 𝙾𝙽𝙻𝚈 𝙱𝙴 𝚄𝚂𝙴𝙳 𝙱𝚈 𝙼𝚈 𝙾𝚆𝙽𝙴𝚁*");

        let target = m.mentionedJid?.[0]
                || m.quoted?.sender
                || (args[0] ? normalizeTarget(args[0]) : null);

        if (!target) return reply("❌ *𝙿𝙻𝙴𝙰𝚂𝙴 𝙿𝚁𝙾𝚅𝙸𝙳𝙴 𝙰 𝚅𝙰𝙻𝙸𝙳 𝙽𝚄𝙼𝙱𝙴𝚁/𝙻𝙸𝙳 𝙾𝚁 𝚃𝙰𝙶/𝚁𝙴𝙿𝙻𝚈 𝙰 𝚄𝚂𝙴𝚁*");

        let owners = loadSudo();
        if (!owners.includes(target)) return reply("❌ *𝚄𝚂𝙴𝚁 𝙽𝙾𝚃 𝙵𝙾𝚄𝙽𝙳 𝙸𝙽 𝙾𝚆𝙽𝙴𝚁 𝙻𝙸𝚂𝚃*");

        owners = owners.filter(x => x !== target);
        saveSudo(owners);

        await conn.sendMessage(from, {
            image: { url: "https://files.catbox.moe/h49t5f.jpg" },
            caption: "✅ *𝚂𝚄𝙲𝙲𝙴𝚂𝚂𝙵𝚄𝙻𝙻𝚈 𝚁𝙴𝙼𝙾𝚅𝙴𝙳 𝚄𝚂𝙴𝚁 𝙰𝚂 𝚃𝙴𝙼𝙿𝙾𝚁𝙰𝚁𝚈 𝙾𝚆𝙽𝙴𝚁*"
        }, { quoted: mek });

    } catch (err) {
        console.error(err);
        reply("❌ Error: " + err.message);
    }
});

cmd({
    pattern: "listsudo",
    alias: ["listowner"],
    desc: "List all temporary owners",
    category: "owner",
    react: "📋",
    filename: __filename
}, async (conn, mek, m, { from, isCreator, reply }) => {
    try {
        let owners = loadSudo();
        if (owners.length === 0) return reply("❌ *𝙽𝙾 𝚃𝙴𝙼𝙿𝙾𝚁𝙰𝚁𝚈 𝙾𝚆𝙽𝙴𝚁 𝙵𝙾𝚄𝙽𝙳*");

        let listMessage = "🤴 *𝙻𝙸𝚂𝚃 𝙾𝙵 𝚂𝚄𝙳𝙾 𝙾𝚆𝙽𝙴𝚁𝚂*\n\n";
        owners.forEach((owner, i) => {
            listMessage += `${i + 1}. ${owner.replace("@lid", "").replace("@s.whatsapp.net", "")}\n`;
        });

        await conn.sendMessage(from, {
            image: { url: "https://files.catbox.moe/h49t5f.jpg" },
            caption: listMessage
        }, { quoted: mek });

    } catch (err) {
        console.error(err);
        reply("❌ Error: " + err.message);
    }
});
