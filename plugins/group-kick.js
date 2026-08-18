const { cmd } = require("../command");

cmd({
    pattern: "kick",
    alias: ["remove"],
    desc: "Kick a member from group",
    category: "group",
    react: "👢",
    filename: __filename
}, async (conn, mek, m, { from, isGroup, sender, reply, isAdmins, isBotAdmins, isOwner, isCreator, quoted, args }) => {
    try {
        if (!isGroup) return reply("❌ Group only");

        if (!isAdmins && !isOwner && !isCreator) {
            return reply("⚠️ Only group admins can use this command.");
        }

        if (!isBotAdmins) {
            return reply("⚠️ Make me admin first.");
        }

        let target;
        if (mek.message?.extendedTextMessage?.contextInfo?.participant) {
            target = mek.message.extendedTextMessage.contextInfo.participant;
        } else if (args[0]) {
            target = args[0].replace(/[^0-9]/g, '') + "@s.whatsapp.net";
        }

        if (!target) {
            return reply("❌ Kis ko kick karna hai? Mention karo ya reply karo.");
        }

        await conn.groupParticipantsUpdate(from, [target], "remove");
        await reply("✅ Kicked successfully.");

    } catch (e) {
        console.error(e);
        reply("❌ Error");
    }
});
