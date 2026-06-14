const { cmd, commands } = require('../command');
const axios = require('axios');

const pairCooldown = new Map();

cmd({
    pattern: "pair",
    alias: ["getpair", "clonebot"],
    react: "✅",
    desc: "Get pairing code for ADEEL-MD bot",
    category: "download",
    use: ".pair 923035512967",
    filename: __filename
}, async (conn, mek, m, { from, quoted, body, isCmd, command, args, q, isGroup, senderNumber, reply }) => {
    try {
        let phoneNumber = q 
            ? q.trim().replace(/[^0-9+]/g, '') 
            : senderNumber.replace(/[^0-9]/g, '');

        phoneNumber = phoneNumber.replace(/\+/g, '');

        if (phoneNumber.startsWith('0') && phoneNumber.length === 11) {
            phoneNumber = '92' + phoneNumber.substring(1);
        }

        if (!phoneNumber || phoneNumber.length < 10 || phoneNumber.length > 15) {
            return await reply("❌ Invalid number\nExample: .pair 923035512967");
        }

        // ━━━ Cooldown - دوبارہ request نہ جائے ━━━
        const now = Date.now();
        const lastUsed = pairCooldown.get(phoneNumber);
        if (lastUsed && now - lastUsed < 60000) return;
        pairCooldown.set(phoneNumber, now);

        const response = await axios.get(`https://adeel-md-new-pair-c6a7630bccda.herokuapp.com/pair?number=${encodeURIComponent(phoneNumber)}`, { timeout: 30000 });

        if (!response.data || !response.data.code) {
            return await reply("❌ Failed to retrieve pairing code.");
        }

        // ━━━ Dash ہٹاؤ ━━━
        const pairingCode = response.data.code.replace(/-/g, '');
        const doneMessage = "> *ADEEL-MD PAIRING COMPLETED*";

        await reply(`${doneMessage}\n\n*Your pairing code is:* ${pairingCode}`);

        await new Promise(resolve => setTimeout(resolve, 2000));

        await reply(`${pairingCode}`);

    } catch (error) {
        console.error("Pair command error:", error);
        pairCooldown.delete(phoneNumber);
        await reply("❌ Error");
    }
});
