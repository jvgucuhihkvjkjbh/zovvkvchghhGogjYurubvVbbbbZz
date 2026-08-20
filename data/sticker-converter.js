const fs = require('fs');
const path = require('path');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
const sharp = require('sharp');

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
        const jobId = Date.now();
        const framesDir = path.join(this.tempDir, `frames_${jobId}`);
        const outputPath = path.join(this.tempDir, `video_${jobId}.mp4`);

        try {
            await fs.promises.mkdir(framesDir, { recursive: true });

            const img = sharp(stickerBuffer, { animated: true });
            const metadata = await img.metadata();

            const pageCount = metadata.pages || 1;
            const pageHeight = metadata.pageHeight || metadata.height;
            const width = metadata.width;

            const { data, info } = await img
                .raw()
                .ensureAlpha()
                .toBuffer({ resolveWithObject: true });

            const channels = info.channels;
            const frameBytes = width * pageHeight * channels;

            let fps = 15;
            if (Array.isArray(metadata.delay) && metadata.delay.length) {
                const avgDelayMs =
                    metadata.delay.reduce((a, b) => a + b, 0) / metadata.delay.length;
                if (avgDelayMs > 0) {
                    fps = Math.min(30, Math.max(1, Math.round(1000 / avgDelayMs)));
                }
            }

            const writes = [];
            for (let i = 0; i < pageCount; i++) {
                const frameBuffer = data.subarray(i * frameBytes, (i + 1) * frameBytes);
                const frameName = path.join(
                    framesDir,
                    `frame_${String(i).padStart(5, '0')}.png`
                );
                writes.push(
                    sharp(frameBuffer, {
                        raw: { width, height: pageHeight, channels }
                    })
                        .png()
                        .toFile(frameName)
                );
            }
            await Promise.all(writes);

            await new Promise((resolve, reject) => {
                ffmpeg()
                    .input(path.join(framesDir, 'frame_%05d.png'))
                    .inputFPS(fps)
                    .outputOptions([
                        '-c:v', 'libx264',
                        '-pix_fmt', 'yuv420p',
                        '-movflags', '+faststart',
                        '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2'
                    ])
                    .on('error', reject)
                    .on('end', resolve)
                    .save(outputPath);
            });

            return await fs.promises.readFile(outputPath);
        } catch (error) {
            console.error('Sticker to video conversion error:', error);
            throw new Error('Failed to convert sticker to video');
        } finally {
            await fs.promises.rm(framesDir, { recursive: true, force: true }).catch(() => {});
            await fs.promises.unlink(outputPath).catch(() => {});
        }
    }
}

module.exports = new StickerConverter();
