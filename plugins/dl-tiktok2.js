const axios = require('axios');
const { cmd } = require("../command");
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const fetchTikTok = async (url) => {
    const encoded = encodeURIComponent(url);
    const apis = [
        {
            url: `https://jerrycoder.oggyapi.workers.dev/down/tiktok?url=${encoded}`,
            extract: (d) => {
                const data = d?.result?.data;
                if (!data) return null;
                return {
                    title: data.title,
                    author: data.author?.unique_id || data.author?.nickname,
                    video: data.play,
                    video_hd: data.hdplay,
                    music: data.music,
                    cover: data.cover,
                    duration: data.duration,
                    likes: data.digg_count,
                    comments: data.comment_count,
                    shares: data.share_count
                };
            }
        },
        {
            url: `https://drkamran.vercel.app/api/download/tiktok?url=${encoded}`,
            extract: (d) => {
                const r = d?.data;
                if (!r?.links?.[0]) return null;
                return {
                    title: r.title,
                    author: r.author,
                    video: r.links[0]
                };
            }
        },
        {
            url: `https://api.princetechn.com/api/download/tiktokdlv2?apikey=prince&url=${encoded}`,
            extract: (d) => {
                const r = d?.result;
                if (!r) return null;
                return {
                    title: r.title,
                    author: r.author?.name,
                    video: r.video,
                    video_hd: r.video_hd,
                    music: r.music,
                    cover: r.cover,
                    duration: r.duration
                };
            }
        },
        {
            url: `https://api.princetechn.com/api/download/tiktokdlv3?apikey=prince&url=${encoded}`,
            extract: (d) => {
                const r = d?.result;
                if (!r) return null;
                return {
                    title: r.title,
                    author: r.author?.name,
                    video: r.video,
                    video_hd: r.video_hd,
                    music: r.music,
                    cover: r.cover,
                    duration: r.duration
                };
            }
        },
        {
            url: `https://api.princetechn.com/api/download/tiktok?apikey=prince&url=${encoded}`,
            extract: (d) => {
                const r = d?.result;
                if (!r) return null;
                return {
                    title: r.title,
                    author: r.author?.name,
                    video: r.video,
                    music: r.music,
                    cover: r.cover,
                    duration: r.duration
                };
            }
        },
        {
            url: `https://api.princetechn.com/api/download/tiktokdlv4?apikey=prince&url=${encoded}`,
            extract: (d) => {
                const r = d?.result;
                if (!r) return null;
                return {
                    title: r.title,
                    author: r.username,
                    video: r.videoUrl,
                    music: r.audioUrl,
                    cover: r.thumbnailUrl
                };
            }
        }
    ];

    for (const api of apis) {
        try {
            const res = await axios.get(api.url, { timeout: 15000 });
            const data = api.extract(res.data);
            if (data?.video) {
                return data;
            }
        } catch (e) {
            continue;
        }
    }
    return null;
};

const downloadAndCompress = async (videoUrl, outputPath) => {
    const tempInput = path.join(path.dirname(outputPath), `temp_${Date.now()}.mp4`);
    
    const response = await axios({
        method: 'get',
        url: videoUrl,
        responseType: 'stream',
        timeout: 30000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    });

    const writer = fs.createWriteStream(tempInput);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on('finish', async () => {
            try {
                execSync(`ffmpeg -i "${tempInput}" -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k "${outputPath}" -y`, { stdio: 'pipe' });
                
                if (fs.existsSync(tempInput)) {
                    fs.unlinkSync(tempInput);
                }
                
                resolve(outputPath);
            } catch (error) {
                if (fs.existsSync(tempInput)) {
                    fs.copyFileSync(tempInput, outputPath);
                    fs.unlinkSync(tempInput);
                }
                resolve(outputPath);
            }
        });

        writer.on('error', (error) => {
            if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
            reject(error);
        });
    });
};

const formatNum = (n) => {
    if (!n) return '0';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
};

cmd({
  pattern: "tt2",
  alias: ["tiktok2", "ttdl2"],
  desc: "Direct TikTok Video Downloader",
  react: "📥",
  category: "download",
  filename: __filename
}, async (conn, mek, m, { from, args, reply }) => {
  try {
    const url = args[0];
    if (!url) return reply("❌ Please provide a TikTok URL.");
    if (!url.includes("tiktok.com")) return reply("❌ Invalid TikTok link.");

    await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

    const data = await fetchTikTok(url);

    if (!data) {
      await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
      return reply("❌ Could not fetch the video. Try again.");
    }

    const videoUrl = data.video_hd || data.video;
    if (!videoUrl) {
      await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
      return reply("❌ No video found.");
    }

    const caption = `🎬 *TIKTOK DOWNLOADER*
📌 *TITLE:* ${data.title || 'No Title'}
👤 *AUTHOR:* ${data.author || 'Unknown'}
⏱️ *DURATION:* ${data.duration ? data.duration + ' SEC' : 'N/A'}
❤️ *LIKES:* ${formatNum(data.likes)}
💬 *COMMENTS:* ${formatNum(data.comments)}
🔗 *SHARES:* ${formatNum(data.shares)}

> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡*`;

    const outputPath = path.join('./temp', `tiktok_${Date.now()}.mp4`);
    if (!fs.existsSync('./temp')) fs.mkdirSync('./temp', { recursive: true });

    await downloadAndCompress(videoUrl, outputPath);

    await conn.sendMessage(from, {
      video: fs.readFileSync(outputPath),
      caption,
      mimetype: "video/mp4",
      fileName: "tiktok.mp4"
    }, { quoted: mek });

    await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });

    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

  } catch (e) {
    console.error("Error:", e.message);
    await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
    reply("❌ Something went wrong.");
  }
});
