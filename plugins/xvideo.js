const { cmd, commands } = require('../command')
const axios = require('axios')

cmd({
    pattern: "xvideos",
    alias: ["xv", "xvdli"],
    desc: "Download videos from xvideos using FFmpeg API.",
    category: "download",
    filename: __filename
},
async (conn, mek, m, { from, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply }) => {
    try {
        if (!q) return reply("❗ Please provide a valid Xvideos URL!")

        const targetUrl = q.trim()
        const initialApiUrl = `https://api.princetechn.com/api/download/xvideosdl?apikey=prince&url=${targetUrl}`
        
        const response = await axios.get(initialApiUrl)
        const data = response.data

        if (data.status === 200 && data.success && data.result && data.result.download_url) {
            const result = data.result
            
            // Passing the direct download URL into your FFmpeg API link
            const ffmpegVideoUrl = `https://imjerryco-ffpeg.hf.space/?url=${result.download_url}`
            
            let caption = `*✨ ADEEL-MD XVIDEOS DOWNLOADER ✨*\n\n`
            caption += `*📝 Title:* ${result.title}\n`
            caption += `*👁️ Views:* ${result.views}\n`
            caption += `*🗳️ Votes:* ${result.votes}\n`
            caption += `*👍 Likes:* ${result.likes}\n`
            caption += `*👎 Dislikes:* ${result.dislikes}\n`
            caption += `*📦 Size:* ${result.size}\n\n`
            caption += `*🚀 Powered By ADEEL-MD*`

            // Send Video using the FFmpeg processed URL
            await conn.sendMessage(from, { 
                video: { url: ffmpegVideoUrl }, 
                caption: caption, 
                mimetype: 'video/mp4' 
            }, { quoted: mek })

        } else {
            return reply("❌ Error: No download link found from the primary API.")
        }

    } catch (e) {
        console.log(e)
        reply(`❌ Error Occurred: ${e.message}`)
    }
})
