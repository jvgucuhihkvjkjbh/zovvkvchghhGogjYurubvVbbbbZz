const { cmd } = require('../command');
const axios = require('axios');
const fs = require("fs");

const HEROKU_URL = 'https://adeel-md-premium-vps-1-702dbfe73594.herokuapp.com';
const ADMIN_PASSWORD = 'adeel-admin-2025';
const OWNER_JID = (process.env.OWNER_NUMBER || '923035512967') + '@s.whatsapp.net';

function isAllowed(sender, isOwner) {
    try {
        let sudoList = [];
        if (fs.existsSync("./lib/sudo.json")) {
            sudoList = JSON.parse(fs.readFileSync("./lib/sudo.json"));
        }
        return isOwner || sudoList.includes(sender);
    } catch { return isOwner; }
}

async function fetchAllUsers() {
    const res = await axios.get(`${HEROKU_URL}/admin/users`, {
        headers: { 'x-admin-password': ADMIN_PASSWORD },
        timeout: 15000
    });
    return res.data.users || [];
}

async function fetchUserBots(username) {
    try {
        const res = await axios.get(`${HEROKU_URL}/admin/users/${username}/bots`, {
            headers: { 'x-admin-password': ADMIN_PASSWORD },
            timeout: 10000
        });
        return res.data.bots || [];
    } catch { return []; }
}

async function buildReport() {
    const users = await fetchAllUsers();
    const now = new Date();

    let totalBots = 0;
    let totalLimit = 0;
    let activeUsers = 0;
    let expiredUsers = 0;

    let report = `📊 *ADEEL-MD VPS REPORT*\n`;
    report += `🕐 *Time:* ${now.toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })}\n`;
    report += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    for (const u of users) {
        const isExpired = u.expiry && new Date(u.expiry) < now;
        const bots = await fetchUserBots(u.username);
        const botCount = bots.length;
        const remaining = (u.limit || 0) - botCount;

        totalBots += botCount;
        totalLimit += u.limit || 0;
        isExpired ? expiredUsers++ : activeUsers++;

        report += `👤 *${u.username.toUpperCase()}*\n`;
        report += `📌 Status: ${isExpired ? '❌ EXPIRED' : '✅ ACTIVE'}\n`;
        report += `🤖 Bots: ${botCount}/${u.limit} | Remaining: ${remaining}\n`;
        if (u.expiry) report += `📅 Expiry: ${new Date(u.expiry).toLocaleDateString('en-PK')}\n`;
        if (u.note) report += `📝 Note: ${u.note}\n`;
        if (bots.length) {
            report += `📋 Bot List:\n`;
            bots.forEach((b, i) => {
                const date = new Date(b.createdAt).toLocaleDateString('en-PK');
                report += `   ${i + 1}. ${b.name} — ${date}\n`;
            });
        }
        report += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    }

    report += `📈 *SUMMARY*\n`;
    report += `👥 Total Users: ${users.length}\n`;
    report += `✅ Active: ${activeUsers}\n`;
    report += `❌ Expired: ${expiredUsers}\n`;
    report += `🤖 Total Bots Deployed: ${totalBots}\n`;
    report += `🎯 Total Limit: ${totalLimit}\n`;
    report += `\n> *⚡ ᴀᴅᴇᴇʟ-ᴍᴅ ᴀᴜᴛᴏ ʀᴇᴘᴏʀᴛ ⚡*`;

    return report;
}

let autoReportInterval = null;

function startAutoReport(client) {
    if (autoReportInterval) clearInterval(autoReportInterval);
    autoReportInterval = setInterval(async () => {
        try {
            const report = await buildReport();
           
            await client.sendMessage(OWNER_JID, { text: report });
        } catch (e) {
            console.log('Auto report error:', e.message);
        }
    }, 30 * 60 * 1000);
    console.log('✅ Auto report started');
}

cmd({
    pattern: 'vpsreport',
    alias: ['vps', 'vpsstatus', 'premiumreport'],
    desc: 'VPS Premium Users Report',
    category: 'owner',
    react: '📊',
    filename: __filename
}, async (client, mek, m, { from, isOwner, sender, reply }) => {

    if (!isAllowed(sender, isOwner)) return reply("❌ This command is restricted.");

    try {
        await client.sendMessage(from, { react: { text: "⏳", key: mek.key } });
        const report = await buildReport();

        await client.sendMessage(OWNER_JID, { text: report });

        if (from !== OWNER_JID) {
            await client.sendMessage(from, {
                text: "✅ Report sent to owner."
            }, { quoted: mek });
        }

        await client.sendMessage(from, { react: { text: "✅", key: mek.key } });

    } catch (e) {
        console.log('VPS Report Error:', e.message);
        reply("❌ Could not fetch report. Check server connection.");
    }
});

cmd({
    pattern: 'startreport',
    alias: ['autoreport'],
    desc: 'Start auto VPS report every 30 min',
    category: 'owner',
    react: '⏰',
    filename: __filename
}, async (client, mek, m, { from, isOwner, sender, reply }) => {

    if (!isAllowed(sender, isOwner)) return reply("❌ This command is restricted.");

    startAutoReport(client);

    await client.sendMessage(from, {
        text: "✅ Auto report started! Every 30 min report will be sent to owner."
    }, { quoted: mek });

    if (from !== OWNER_JID) {
        await client.sendMessage(OWNER_JID, {
            text: `⏰ *Auto VPS Report Started*\n\nStarted by: ${sender}\nEvery 30 minutes you will receive report.`
        });
    }

    await client.sendMessage(from, { react: { text: "✅", key: mek.key } });
});

cmd({
    pattern: 'stopreport',
    desc: 'Stop auto VPS report',
    category: 'owner',
    react: '⏹️',
    filename: __filename
}, async (client, mek, m, { from, isOwner, sender, reply }) => {

    if (!isAllowed(sender, isOwner)) return reply("❌ This command is restricted.");

    if (autoReportInterval) {
        clearInterval(autoReportInterval);
        autoReportInterval = null;
        reply("✅ Auto report stopped.");
        if (from !== OWNER_JID) {
            await client.sendMessage(OWNER_JID, {
                text: `⏹️ *Auto VPS Report Stopped*\n\nStopped by: ${sender}`
            });
        }
    } else {
        reply("❌ Auto report is not running.");
    }

    await client.sendMessage(from, { react: { text: "✅", key: mek.key } });
});

module.exports = { startAutoReport };