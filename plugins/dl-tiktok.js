const axios = require("axios");
const cheerio = require("cheerio");
const { cmd } = require("../command");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const stream = require("stream");
const pipeline = promisify(stream.pipeline);

async function compressVideo(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .videoCodec("libx264")
            .audioCodec("aac")
            .outputOptions([
                "-crf 28",        // quality — 28 = good balance
                "-preset fast",   // speed
                "-vf scale=720:-2" // max 720p
            ])
            .output(outputPath)
            .on("end", resolve)
            .on("error", reject)
            .run();
    });
}

async function getTikTokHDVideo(url) {
    const res = await axios.post(
        "https://savetik.co/api/ajaxSearch",
        new URLSearchParams({ q: url, lang: "en" }),
        {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0",
                "Content-Type": "application/x-www-form-urlencoded",
                "Referer": "https://savetik.co/en",
                "Origin": "https://savetik.co"
            },
            timeout: 20000
        }
    );

    const $ = cheerio.load(res.data?.data || res.data);
    const title = $("p.tik-name, p.maintext, h3, .video-title").first().text().trim() || "TikTok Video";
    const hdLink = $("a:contains('Download MP4 HD'), a:contains('MP4 HD'), a[href*='-hd']").first().attr("href") || null;
    const sdLink = $("a:contains('Download MP4 [1]'), a:contains('MP4')").first().attr("href") || null;

    return { title, videoLink: hdLink || sdLink };
}

cmd({
    pattern: "tiktok",
    alias: ["tt", "tiktokdl", "ttdl"],
    react: "🎵",
    desc: "Download TikTok videos in HD without watermark",
    category: "download",
    use: ".tiktok <TikTok link>",
    filename: __filename
}, async (conn, mek, m, { from, reply, args }) => {
    try {
        const url = args[0];

        if (!url) return reply("⚠️ Please provide a TikTok link.\nExample: .tiktok https://vm.tiktok.com/xxx");

        const validDomains = ["tiktok.com", "vm.tiktok.com", "vt.tiktok.com", "m.tiktok.com", "douyin.com"];
        if (!validDomains.some(d => url.includes(d))) return reply("⚠️ Please provide a valid TikTok link.");

        await conn.sendMessage(from, { react: { text: "⏳", key: m.key } });

        const data = await getTikTokHDVideo(url);
        if (!data?.videoLink) return reply("❌ Could not get download link. Please try again.");

        // Video download karo buffer mein
        const videoRes = await axios.get(data.videoLink, { responseType: "arraybuffer", timeout: 60000 });
        const originalBuffer = Buffer.from(videoRes.data);

        const tmpInput = path.join("/tmp", `tt_in_${Date.now()}.mp4`);
        const tmpOutput = path.join("/tmp", `tt_out_${Date.now()}.mp4`);

        let finalBuffer;

        try {
            // Temp file likhо
            fs.writeFileSync(tmpInput, originalBuffer);

            // Compress karo
            await compressVideo(tmpInput, tmpOutput);

            finalBuffer = fs.readFileSync(tmpOutput);
        } catch (e) {
            console.log("Compress failed, sending original:", e.message);
            finalBuffer = originalBuffer; // compress fail ho to original bhejo
        } finally {
            // Cleanup temp files
            if (fs.existsSync(tmpInput)) fs.unlinkSync(tmpInput);
            if (fs.existsSync(tmpOutput)) fs.unlinkSync(tmpOutput);
        }

        const caption = `🎵 *TIKTOK VIDEO* 🎵\n\n📖 *TITLE:* ${data.title}\n\n> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ* 👑`;

        await conn.sendMessage(from, {
            video: finalBuffer,
            caption: caption,
            mimetype: "video/mp4"
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: "✅", key: m.key } });

    } catch (error) {
        console.error("TikTok error:", error.message);
        reply(`❌ Error: ${error.message}`);
        try { await conn.sendMessage(from, { react: { text: "❌", key: m.key } }); } catch {}
    }
});
