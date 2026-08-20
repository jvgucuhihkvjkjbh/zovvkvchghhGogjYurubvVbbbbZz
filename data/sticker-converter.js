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

    // Animated WebP to MP4 Video (Direct API Fallback System)
    async convertStickerToVideo(stickerBuffer) {
        try {
            const bodyForm = new FormData();
            bodyForm.append('new-image-url', '');
            bodyForm.append('new-image', stickerBuffer, {
                filename: 'sticker.webp',
                contentType: 'image/webp'
            });

            // Step 1: Upload to Ezgif
            const res1 = await axios.post('https://ezgif.com/webp-to-mp4', bodyForm, {
                headers: bodyForm.getHeaders()
            });

            const html1 = res1.data;
            const fileMatch = html1.match(/<input type="hidden" name="file" value="(.*?)"/);
            
            if (!fileMatch) throw new Error("Upload to Ezgif failed");

            const fileName = fileMatch[1];

            // Step 2: Convert to MP4
            const convertForm = new FormData();
            convertForm.append('file', fileName);
            convertForm.append('convert', 'Convert WebP to MP4!');

            const res2 = await axios.post(`https://ezgif.com/webp-to-mp4/${fileName}`, convertForm, {
                headers: convertForm.getHeaders()
            });

            const html2 = res2.data;
            const videoMatch = html2.match(/<source src="(.*?)" type="video\/mp4">/);

            if (!videoMatch) throw new Error("Conversion failed on Ezgif");

            const videoUrl = 'https:' + videoMatch[1];

            // Step 3: Fetch MP4 Buffer
            const videoBuffer = await axios.get(videoUrl, { responseType: 'arraybuffer' });
            return Buffer.from(videoBuffer.data);

        } catch (error) {
            console.error('EZGIF Error, trying local FFmpeg fallback...', error.message);
            
            // Fallback: Try FFmpeg locally if WebP has VP8X frame support
            const tempPath = path.join(this.tempDir, `vsticker_${Date.now()}.webp`);
            const outputPath = path.join(this.tempDir, `video_${Date.now()}.mp4`);

            try {
                await fs.promises.writeFile(tempPath, stickerBuffer);

                await new Promise((resolve, reject) => {
                    ffmpeg(tempPath)
                        .inputOptions(['-ignore_loop 0'])
                        .outputOptions([
                            '-movflags faststart',
                            '-pix_fmt yuv420p',
                            '-vf scale=trunc(iw/2)*2:trunc(ih/2)*2'
                        ])
                        .on('error', reject)
                        .on('end', resolve)
                        .output(outputPath)
                        .run();
                });

                return await fs.promises.readFile(outputPath);
            } catch (ffmpegErr) {
                console.error('FFmpeg Fallback Failed:', ffmpegErr);
                throw new Error("Failed to convert sticker to video.");
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
