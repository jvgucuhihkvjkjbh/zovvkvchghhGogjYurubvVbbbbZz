const { cmd } = require("../command");

cmd({
    pattern: "getlid",
    alias: ["lidcheck"],
    desc: "Check WhatsApp ID info for a number",
    category: "owner",
    react: "🔍",
    filename: __filename
},
async (conn, mek, m, { from, reply, q, isCreator }) => {

    try {

        if (!isCreator) return reply("❌ only owner command use");

        if (!q) return reply("❌ Number do (jaise: .getlid 923001234567)");

        const number = q.replace(/\D/g, "");
        const result = await conn.onWhatsApp(number + "@s.whatsapp.net");

        if (!result || result.length === 0) {
            return reply("❌ Ye number WhatsApp pe nahi mila");
        }

        let info = `*Number:* ${number}\n`;
        result.forEach(r => {
            info += `\n*JID:* ${r.jid}`;
            if (r.lid) info += `\n*LID:* ${r.lid}`;
        });

        reply(info);

    } catch (e) {
        console.error(e);
        reply("❌ Error: " + e.message);
    }
});
