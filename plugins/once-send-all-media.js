const converter = require('../data/converter');
const { cmd } = require('../command');
const fs = require("fs");
const { jidNormalizedUser, decodeJid } = require('@whiskeysockets/baileys');

cmd({
pattern: 'onceall',
alias: ['viewonce', 'sendvv'],
desc: 'Send media as view-once (image/video/audio)',
category: 'media',
react: '👁️',
filename: __filename
}, async (client, m, message, { from, isOwner, args, sender }) => {

if (!m.quoted) return;

try {

// خود کو میسج بھیجنے کی صورت میں جے آئی ڈی کو بالکل درست پیور فارمیٹ میں تبدیل کرنا
let targetJid = jidNormalizedUser(decodeJid(from));

const input = args.join('').trim();

let sudoList = [];
if (fs.existsSync("./lib/sudo.json")) {
    sudoList = JSON.parse(fs.readFileSync("./lib/sudo.json"));
}

const normalize = (id) => id.replace(/[^0-9]/g, '');
const isSudo = sudoList.map(normalize).includes(normalize(sender));

if (input) {

    if (!isOwner && !isSudo) return;

    let cleanInput = input.replace(/\s+/g, '');

    if (cleanInput.includes('@g.us')) {
        targetJid = cleanInput.trim();
    } 
    
    else {
        // نمبر نکالنے کا فول پروف طریقہ تاکہ کوئی فالتو کیریکٹر جے آئی ڈی خراب نہ کرے
        let pureNumbers = cleanInput.replace(/[^0-9]/g, '');
        
        if (pureNumbers.length > 5) {
            const formatted =
                pureNumbers.startsWith('0')
                    ? '92' + pureNumbers.slice(1)
                    : pureNumbers;

            targetJid = formatted + '@s.whatsapp.net';
        }
    }
}

// فائنل جے آئی ڈی کو ایک بار پھر انکرپشن لیئر کے لیے ری-فارمیٹ کریں
targetJid = jidNormalizedUser(decodeJid(targetJid));

// میڈیا بفر ڈاؤن لوڈنگ ہینڈلر
const buffer = await m.quoted.download();
if (!buffer) return;

let msg = {};

if (m.quoted.mtype === 'imageMessage') {
    msg = {
        image: buffer,
        caption: m.quoted.caption || '',
        viewOnce: true
    };
}

else if (m.quoted.mtype === 'videoMessage') {
    msg = {
        video: buffer,
        caption: m.quoted.caption || '',
        viewOnce: true
    };
}

else if (m.quoted.mtype === 'audioMessage') {
    const ptt = await converter.toPTT(buffer, 'm4a');
    msg = {
        audio: ptt,
        mimetype: 'audio/mp4',
        ptt: true,
        viewOnce: true
    };
}

else {
    return;
}

// ٹارگٹ جے آئی ڈی پر میڈیا روانہ کریں
await client.sendMessage(targetJid, msg);

// کامیابی کا گرین ٹک ری ایکشن
await client.sendMessage(from, {
    react: { text: "✅", key: message.key }
});

} catch (e) {
console.error('VV Error:', e);
}

});
