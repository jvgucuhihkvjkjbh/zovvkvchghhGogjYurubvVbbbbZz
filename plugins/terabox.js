const { cmd } = require('../command');
const axios = require('axios');

cmd({
    pattern: "terabox",
    alias: ["tera", "tbx", "terabox2"],
    desc: "Download Terabox video",
    category: "download",
    react: "📦",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    try {

        if (!q) {
            return reply("❌ Terabox link do\nExample: .terabox https://terabox.com/s/xxxx");
        }

        const url = q.trim();

        const validDomains = [
            "terabox.com",
            "1024terabox.com",
            "1024tera.com",
            "terasharefile.com",
            "teraboxapp.com",
            "terabox.app",
            "freeterabox.com",
            "4funbox.com",
            "mirrorbox.com",
            "mirrobox.com",
            "nephobox.com"
        ];

        const isValid = validDomains.some(domain => url.includes(domain));

        if (!isValid) {
            return reply("❌ Valid Terabox link do");
        }

        await conn.sendMessage(from, {
            react: {
                text: "⏳",
                key: mek.key
            }
        });

        let data;

        // =========================
        // API 1
        // =========================

        try {

            const api1 = await axios.get(
                `https://jerrycoder.oggyapi.workers.dev/turbo?url=${encodeURIComponent(url)}`,
                {
                    timeout: 30000
                }
            );

            if (api1.data && api1.data.status === "success") {

                data = {
                    type: "api1",
                    title: api1.data.title,
                    size: api1.data.size,
                    thumbnail: api1.data.thumbnail,
                    download: api1.data.download || api1.data.stream
                };

            }

        } catch (e) {
            console.log("API1 Failed");
        }

        // =========================
        // API 2 Fallback
        // =========================

        if (!data) {

            try {

                const api2 = await axios.get(
                    `https://jerryproxy.vercel.app/api/download?url=${encodeURIComponent(url)}`,
                    {
                        timeout: 30000
                    }
                );

                const res = api2.data;

                if (
                    res.status &&
                    res.result &&
                    res.result.files &&
                    res.result.files.length > 0
                ) {

                    const file = res.result.files[0];

                    data = {
                        type: "api2",
                        title: file.file_name,
                        size: file.size_mb || "Unknown",
                        thumbnail: file.thumbnail,
                        download:
                            file.download ||
                            file.streams?.["720p"] ||
                            file.streams?.["480p"] ||
                            file.streams?.["360p"]
                    };

                }

            } catch (e) {
                console.log("API2 Failed");
            }

        }

        // =========================
        // Final Check
        // =========================

        if (!data || !data.download) {
            return reply("❌ Download failed. Try another Terabox link.");
        }

        let sizeText = data.size;

        if (!isNaN(sizeText)) {
            sizeText = (Number(sizeText) / 1024 / 1024).toFixed(2) + " MB";
        }

        const caption = `🎬 *${data.title}*

📦 Size: ${sizeText}

> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴀᴅᴇᴇʟ-ᴍᴅ ⚡`;

        // =========================
        // Thumbnail
        // =========================

        if (data.thumbnail) {

            await conn.sendMessage(from, {
                image: {
                    url: data.thumbnail
                },
                caption: caption
            }, {
                quoted: mek
            });

        }

        // =========================
        // Video Send
        // =========================

        await conn.sendMessage(from, {
            video: {
                url: data.download
            },
            mimetype: "video/mp4",
            fileName: data.title,
            caption: caption
        }, {
            quoted: mek
        });

        await conn.sendMessage(from, {
            react: {
                text: "✅",
                key: mek.key
            }
        });

    } catch (e) {

        console.log("TERABOX ERROR:", e);

        await conn.sendMessage(from, {
            react: {
                text: "❌",
                key: mek.key
            }
        });

        reply("❌ Error occurred while downloading");
    }
});
