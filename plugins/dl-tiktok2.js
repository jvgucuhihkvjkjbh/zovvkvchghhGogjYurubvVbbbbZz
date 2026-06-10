const axios = require('axios');
const { cmd } = require("../command");

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
            console.log(`TikTok trying: ${api.url}`);
            const res = await axios.get(api.url, { timeout: 15000 });
            const data = api.extract(res.data);
            if (data?.video) {
                console.log(`TikTok success: ${api.url}`);
                return data;
            }
        } catch (e) {
            console.log(`TikTok API failed: ${api.url} — ${e.message}`);
            continue;
        }
    }
    return null;
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
    const caption =
`🎬 *TIKTOK DOWNLOADER* 🎬
📌 *TITLE:* ${data.title || 'No Title'}
👤 *AUTHOR:* ${data.author || 'Unknown'}
⏱️ *DURATION:* ${data.duration ? data.duration + ' SEC' : 'N/A'}
━━━━━━━━━━━━━━━━━━━━
❤️ *LIKES:* ${formatNum(data.likes)}
💬 *COMMENTS:* ${formatNum(data.comments)}
🔗 *SHARES:* ${formatNum(data.shares)}

> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡*`;

    await conn.sendMessage(from, {
      video: { url: videoUrl },
      caption,
      mimetype: "video/mp4",
      fileName: "tiktok.mp4"
    }, { quoted: mek });

    await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });

  } catch (e) {
    console.error("TikTok Error:", e.message);
    await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
    reply("❌ Something went wrong. Please try again later.");
  }
});
