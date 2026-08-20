const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');

// Set ffmpeg path
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

    async convertStickerToVideo(stickerBuffer) {
        const tempPath = path.join(this.tempDir, `vsticker_${Date.now()}.webp`);
        const outputPath = path.join(this.tempDir, `video_${Date.now()}.mp4`);

        try {
            await fs.promises.writeFile(tempPath, stickerBuffer);

            await new Promise((resolve, reject) => {
                ffmpeg(tempPath)
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
        } catch (error) {
            console.error('Video conversion error:', error);
            throw new Error('Failed to convert sticker to video');
        } finally {
            await Promise.all([
                fs.promises.unlink(tempPath).catch(() => {}),
                fs.promises.unlink(outputPath).catch(() => {})
            ]);
        }
    }
}

module.exports = new StickerConverter();
