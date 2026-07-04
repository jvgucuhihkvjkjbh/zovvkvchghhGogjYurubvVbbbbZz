const { cmd } = require('../command');
const axios = require('axios');

cmd({
    pattern: 'sms',
    alias: ['sendsms', 'txtsms'],
    desc: 'Send SMS to any number',
    category: 'tools',
    react: '📱',
    filename: __filename
}, async (client, m, message, { from, reply, isOwner, isCreator, args }) => {

    if (!isOwner && !isCreator) return reply('❌ Only owner can use this.');
    if (args.length < 2) return reply('❌ Usage: .sms 923001234567 your message here');

    try {

        let rawNumber = args[0];
        let msg = args.slice(1).join(' ');

        rawNumber = rawNumber.replace(/[^0-9]/g, '');

        if (rawNumber.startsWith('0')) {
            rawNumber = '92' + rawNumber.slice(1);
        } else if (rawNumber.length <= 10) {
            rawNumber = '92' + rawNumber;
        }

        if (!msg) return reply('❌ Message cannot be empty.');

        if (msg.length > 75) {
            return reply(`❌ Message too long! Max *75 characters* allowed.\nYour message: *${msg.length}* characters.`);
        }

        await reply('📤 Sending SMS...');

        const encodedMsg = encodeURIComponent(msg);
        const res = await axios.get(
            `https://jerrycoder.oggyapi.workers.dev/tool/sms?number=${rawNumber}&message=${encodedMsg}`,
            { timeout: 15000 }
        );

        const data = res.data;
        console.log('SMS API Response:', JSON.stringify(data));

        if (data.success === true || data?.response?.type === 'success') {
            await reply(
`╭────⬡ 📱 SMS SENT ⬡────
├✅ *Status:* Success
├📞 *To:* +${rawNumber}
├💬 *Message:* ${msg}
├📊 *Length:* ${msg.length}/75
╰──────────────────────`
            );
        } else {
            await reply(`❌ SMS failed.\nAPI Response: ${JSON.stringify(data)}`);
        }

    } catch (e) {
        console.error('SMS ERROR:', e.message, e?.response?.data);
        reply(`❌ Error: ${e.message}`);
    }

});
