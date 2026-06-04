const axios = require('axios');
const config = require('../config')
const {cmd , commands} = require('../command')
const googleTTS = require('google-tts-api')

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
    
    try {
        const res = await axios.get(
            `https://api.princetechn.com/api/ai/tts?apikey=prince&text=${encodeURIComponent(q)}&voice=en_us_female`,
            { timeout: 15000 }
        );
        const audioUrl = res.data?.result?.download_url || res.data?.result?.url || res.data?.url;
        if (audioUrl) {
            return await conn.sendMessage(from, { audio: { url: audioUrl }, mimetype: 'audio/mpeg', ptt: true }, { quoted: mek });
        }
    } catch (e) {
        console.log("Prince TTS Error:", e.message);
    }

    const url = googleTTS.getAudioUrl(q, {
        lang: 'hi-IN',
        slow: false,
        host: 'https://translate.google.com',
    });
    await conn.sendMessage(from, { audio: { url: url }, mimetype: 'audio/mpeg', ptt: true }, { quoted: mek });

} catch(a) {
    reply(`${a}`)
}
})
