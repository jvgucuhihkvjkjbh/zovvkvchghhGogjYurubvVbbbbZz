const { cmd } = require("../command");
const fs = require("fs");

let sudoList = [];
if (fs.existsSync("./lib/sudo.json")) {
    sudoList = JSON.parse(fs.readFileSync("./lib/sudo.json"));
}

const normalizeId = (id) => {
    if (!id) return '';
    return id
        .replace(/:[0-9]+/g, '')
        .replace(/@(lid|s.whatsapp.net|c.us|g.us)/g, '')
        .replace(/[^\d]/g, '');
};

async function isUserAdmin(conn, chatId, userId) {
    const metadata = await conn.groupMetadata(chatId);
    const participants = metadata.participants || [];
    const user = normalizeId(userId);

    return participants.some(p => {
        const ids = [p.id, p.lid, p.jid, p.phoneNumber].filter(Boolean);
        return ids.some(id => normalizeId(id) === user) &&
            (p.admin === "admin" || p.admin === "superadmin");
    });
}

async function isBotAdmin(conn, chatId) {
    const metadata = await conn.groupMetadata(chatId);
    const participants = metadata.participants || [];

    const botId = normalizeId(conn.user?.id || '');
    const botLid = normalizeId(conn.user?.lid || '');

    return participants.some(p => {
        if (!(p.admin === "admin" || p.admin === "superadmin")) return false;

        const ids = [p.id, p.lid, p.phoneNumber].filter(Boolean);
        return ids.some(id => {
            const n = normalizeId(id);
            return n === botId || n === botLid;
        });
    });
}

cmd({
    pattern: "gcpp",
    alias: ["setgcpp", "setgcpic"],
    desc: "Set Group Profile Picture",
    category: "group",
    react: "🖼️",
    filename: __filename
},
async (conn, mek, m, { from, isGroup, sender, reply }) => {
    try {

        if (!isGroup) return reply("❌ This command only works in groups");

        const userAdmin = await isUserAdmin(conn, from, sender);
        const botAdmin = await isBotAdmin(conn, from);

        const senderNorm = normalizeId(sender);
        const isSudo = sudoList.some(s => normalizeId(s) === senderNorm);

        if (!userAdmin && !isSudo) {
            return reply("❌ Only group admins can use this command");
        }

        if (!botAdmin) return reply("❌ Bot must be admin");

        let quoted = mek.quoted ? mek.quoted : mek;
        let mime = quoted.mimetype || quoted.msg?.mimetype;

        if (!mime && mek.message?.imageMessage) {
            mime = "image";
            quoted = mek;
        }

        if (!mime || !mime.startsWith("image")) {
            return reply("📸 Reply to an image OR send image with .gcpp caption");
        }

        let img = await quoted.download();

        await conn.updateProfilePicture(from, img);

        reply("✅ Group profile picture updated successfully");

    } catch (e) {
        console.log(e);
        reply("❌ Error updating group picture");
    }
});