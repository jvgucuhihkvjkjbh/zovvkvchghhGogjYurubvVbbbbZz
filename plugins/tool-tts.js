const axios = require('axios');
const config = require('../config')
const {cmd , commands} = require('../command')
const googleTTS = require('google-tts-api')
const converter = require('../data/converter');

cmd({
    pattern: "tts",
    desc: "Text to speech",
    category: "download",
    react: "👧",
    filename: __filename
},
async(conn, mek, m,{from, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply}) => {
try{
    if(!q) return reply("Need some text.")

    let audioBuffer = null;

    try {
        const res = await axios.get(
            `https://api.princetechn.com/api/ai/tts?apikey=prince&text=${encodeURIComponent(q)}&voice=en_us_female`,
            { timeout: 15000 }
        );
        const audioUrl = res.data?.result?.download_url || res.data?.result?.url || res.data?.url;
        if (audioUrl) {
            const audioRes = await axios.get(audioUrl, { responseType: 'arraybuffer', timeout: 30000 });
            audioBuffer = Buffer.from(audioRes.data);
        }
    } catch (e) {
        console.log("Prince TTS Error:", e.message);
    }

    if (!audioBuffer) {
        try {
            const url = googleTTS.getAudioUrl(q, {
                lang: 'hi-IN',
                slow: false,
                host: 'https://translate.google.com',
            });
            const audioRes = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
            audioBuffer = Buffer.from(audioRes.data);
        } catch (e) {
            console.log("Google TTS Error:", e.message);
        }
    }

    if (!audioBuffer) return reply("❌ TTS failed. Try again.");

    const ptt = await converter.toPTT(audioBuffer, 'mp3');

    await conn.sendMessage(from, {
        audio: ptt,
        mimetype: 'audio/ogg; codecs=opus',
        ptt: true
    }, { quoted: mek });

} catch(a) {
    console.log("TTS Error:", a);
    reply(`${a}`)
}
})
