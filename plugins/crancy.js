const axios = require('axios');
const { cmd } = require('../command');

const countryMap = {
    'pakistan': 'PKR', 'pak': 'PKR', 'pkr': 'PKR',
    'india': 'INR', 'ind': 'INR', 'inr': 'INR',
    'usa': 'USD', 'america': 'USD', 'usd': 'USD',
    'uk': 'GBP', 'england': 'GBP', 'gbp': 'GBP',
    'saudi': 'SAR', 'saudi arabia': 'SAR', 'sar': 'SAR',
    'uae': 'AED', 'dubai': 'AED', 'aed': 'AED',
    'kuwait': 'KWD', 'kwd': 'KWD',
    'qatar': 'QAR', 'qar': 'QAR'
};

cmd({
    pattern: "currency",
    alias: ["crancy", "price", "pay", "rate"],
    desc: "Check currency rate. Example: .currency pak",
    category: "utility",
    react: "💰",
    filename: __filename
}, async (sock, message, m, { q, reply }) => {
    try {
        let input = q ? q.toLowerCase().trim() : "";
        if (!input) return reply("❌ Please provide a country name!\nExample: .currency pak");

        await sock.sendMessage(message.chat, { react: { text: "⏳", key: message.key } });

        let fromCurrency = "USD"; 
        let targetCountry = input;

        if (input.includes(" to ")) {
            let parts = input.split(" to ");
            targetCountry = parts[0].trim();
            fromCurrency = countryMap[parts[1].trim()] || parts[1].trim().toUpperCase();
        }

        let toCurrency = countryMap[targetCountry] || targetCountry.toUpperCase();

        const res = await axios.get(`https://open.er-api.com/v6/latest/${fromCurrency}`);
        const rate = res.data.rates[toCurrency];

        if (!rate) return reply("❌ Invalid country or currency code.");

        const responseText = `*───〔 💰 ᴄᴜʀʀᴇɴᴄʏ ʀᴀᴛᴇ 〕───*

● *ғʀᴏᴍ:* 1 ${fromCurrency}
● *ᴛᴏ:* ${toCurrency}
● *ᴄᴜʀʀᴇɴᴛ ʀᴀᴛᴇ:* ${rate.toFixed(2)}

*────────────────────*

> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ*`;

        await sock.sendMessage(message.chat, { text: responseText }, { quoted: message });
        await sock.sendMessage(message.chat, { react: { text: "✅", key: message.key } });

    } catch (err) {
        console.log("Currency Error:", err);
        reply("❌ Connection failed. Try again later.");
    }
});
