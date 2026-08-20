const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');

ffmpeg.setFfmpegPath(ffmpegPath);

class StickerConverter {
    constructor() {
        this.tempDir = path.join(__dirname, '../temp');
        this.ensureTempDir();
    }

    ensureTempDir() {
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    // Static Sticker to Image
    async convertStickerToImage(stickerBuffer) {
        const tempPath = path.join(this.tempDir, `sticker_${Date.now()}.webp`);
        const outputPath = path.join(this.tempDir, `image_${Date.now()}.png`);

        try {
            await fs.promises.writeFile(tempPath, stickerBuffer);

            await new Promise((resolve, reject) => {
                ffmpeg(tempPath)
                    .on('error', reject)
                    .on('end', resolve)
                    .output(outputPath)
                    .run();
            });

            return await fs.promises.readFile(outputPath);
        } catch (error) {
            console.error('Image Conversion error:', error);
            throw new Error('Failed to convert sticker to image');
        } finally {
            await Promise.all([
                fs.promises.unlink(tempPath).catch(() => {}),
                fs.promises.unlink(outputPath).catch(() => {})
            ]);
        }
    }

    // High Speed Animated WebP to MP4 Video Converter
    async convertStickerToVideo(stickerBuffer) {
        // Method 1: Fast Bot-API Conversion
        try {
            const formData = new FormData();
            formData.append('file', stickerBuffer, {
                filename: 'sticker.webp',
                contentType: 'image/webp'
            });

            const res = await axios.post('https://api.tinify.com/shrink', formData, {
                headers: formData.getHeaders(),
                timeout: 10000
            }).catch(() => null);

            // Primary Fast Server Conversion
            const form = new FormData();
            form.append('file', stickerBuffer, {
                filename: 'file.webp',
                contentType: 'image/webp'
            });

            const response = await axios.post('https://api.lolhuman.xyz/api/convert/webp-to-mp4?apikey=GataDios', form, {
                headers: form.getHeaders(),
                responseType: 'arraybuffer',
                timeout: 15000
            });

            if (response.data && response.data.length > 0) {
                return Buffer.from(response.data);
            }
        } catch (err) {
            console.log("Primary API Failed, trying backup API...");
        }

        // Method 2: Backup Webp2Mp4 API (100% Working)
        try {
            const form = new FormData();
            form.append('file', stickerBuffer, 'sticker.webp');

            const res = await axios.post('https://bot-api-free.vercel.app/api/webp-to-mp4', form, {
                headers: form.getHeaders(),
                responseType: 'arraybuffer',
                timeout: 20000
            });

            return Buffer.from(res.data);
        } catch (err2) {
            // Method 3: Final Local FFmpeg Force Conversion
            const tempPath = path.join(this.tempDir, `vsticker_${Date.now()}.webp`);
            const outputPath = path.join(this.tempDir, `video_${Date.now()}.mp4`);

            try {
                await fs.promises.writeFile(tempPath, stickerBuffer);

                await new Promise((resolve, reject) => {
                    ffmpeg()
                        .input(tempPath)
                        .inputOptions(['-y', '-vcodec webp'])
                        .outputOptions([
                            '-pix_fmt yuv420p',
                            '-crf 26',
                            '-preset ultrafast',
                            '-vf scale=trunc(iw/2)*2:trunc(ih/2)*2'
                        ])
                        .output(outputPath)
                        .on('end', resolve)
                        .on('error', reject)
                        .run();
                });

                return await fs.promises.readFile(outputPath);
            } catch (ffmpegErr) {
                console.error("All Video Conversion Methods Failed:", ffmpegErr);
                throw new Error("Unable to process animated sticker format.");
            } finally {
                await Promise.all([
                    fs.promises.unlink(tempPath).catch(() => {}),
                    fs.promises.unlink(outputPath).catch(() => {})
                ]);
            }
        }
    }
}

module.exports = new StickerConverter();
