const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const cheerio = require('cheerio');
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

    // Static Sticker to Image (FFmpeg)
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
            console.error('Conversion error:', error);
            throw new Error('Failed to convert sticker to image');
        } finally {
            await Promise.all([
                fs.promises.unlink(tempPath).catch(() => {}),
                fs.promises.unlink(outputPath).catch(() => {})
            ]);
        }
    }

    // Animated WebP to MP4 Converter (EZGIF Online Converter Service)
    async convertStickerToVideo(stickerBuffer) {
        try {
            const form = new FormData();
            form.append('new-image', stickerBuffer, {
                filename: 'sticker.webp',
                contentType: 'image/webp'
            });

            // Upload WebP to ezgif
            const uploadRes = await axios.post('https://ezgif.com/webp-to-mp4', form, {
                headers: form.getHeaders()
            });

            const $ = cheerio.load(uploadRes.data);
            const file = $('input[name="file"]').val();

            if (!file) {
                throw new Error('EZGIF upload failed');
            }

            // Convert WebP to MP4
            const convertForm = new FormData();
            convertForm.append('file', file);
            convertForm.append('convert', 'Convert WebP to MP4!');

            const convertRes = await axios.post(`https://ezgif.com/webp-to-mp4/${file}`, convertForm, {
                headers: convertForm.getHeaders()
            });

            const $2 = cheerio.load(convertRes.data);
            const videoUrl = 'https:' + $2('p.outline source').attr('src');

            if (!videoUrl) {
                throw new Error('Failed to get converted MP4 URL');
            }

            // Download final MP4 buffer
            const videoBuffer = await axios.get(videoUrl, { responseType: 'arraybuffer' });
            return videoBuffer.data;

        } catch (error) {
            console.error('Video WebP conversion error:', error.message);
            throw new Error('Failed to convert animated sticker to video');
        }
    }
}

module.exports = new StickerConverter();
