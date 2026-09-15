const { cmd } = require("../command");
const { isSudo } = require("../lib/sudo");

cmd({
    pattern: "update",
    alias: ["restart"],
    desc: "Restart bot",
    category: "owner",
    react: "🚀",
    filename: __filename
},
async (conn, mek, m, { from, reply, isCreator, sender }) => {

    try {

        if (!isCreator && !isSudo(sender)) {
            return reply("❌ only owner command use");
        }

        await reply("*BOT RESTART*");

        setTimeout(() => {
            require('child_process').exec("pm2 restart all");
        }, 1000);

    } catch (e) {
        console.error(e);
        reply("❌ Error");
    }
});
