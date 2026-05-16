const { cmd, commands } = require('../command')
const axios = require('axios')

cmd({
    pattern: "xvideos",
    alias: ["xv", "xvdli"],
    desc: "Download videos from xvideos.",
    category: "download",
    filename: __filename
},
async (conn, mek, m, { from, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply }) => {
    try {
        if (!q) return reply("❗ Please provide a valid Xvideos URL!")

        const apiUrl = `https://api.princetechn.com/api/download/xvideosdl?apikey=prince&url=${encodeURIComponent(q)}`
        const response = await axios.get(apiUrl)
        const data = response.data

        if (data.status === 200 && data.success) {
            const result = data.result
            
            let caption = `*✨ ADEEL-MD XVIDEOS DOWNLOADER ✨*\n\n`
            caption += `*📝 Title:* ${result.title}\n`
            caption += `*👁️ Views:* ${result.views}\n`
            caption += `*🗳️ Votes:* ${result.votes}\n`
            caption += `*👍 Likes:* ${result.likes}\n`
            caption += `*👎 Dislikes:* ${result.dislikes}\n`
            caption += `*📦 Size:* ${result.size}\n\n`
            caption += `*🚀 Powered By ADEEL-MD*`

            // Send Video
            await conn.sendMessage(from, { 
                video: { url: result.download_url }, 
                caption: caption, 
                mimetype: 'video/mp4' 
            }, { quoted: mek })

        } else {
            return reply("❌ Error: Unable to fetch video details from API.")
        }

    } catch (e) {
        console.log(e)
        reply(`❌ Error Occurred: ${e.message}`)
    }
})
