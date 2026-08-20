const fs = require('fs');
const path = require('path');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
const sharp = require('sharp');

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
            // Save sticker to temp file
            await fs.promises.writeFile(tempPath, stickerBuffer);

            // Convert using fluent-ffmpeg (same as your video sticker converter)
            await new Promise((resolve, reject) => {
                ffmpeg(tempPath)
                    .on('error', reject)
                    .on('end', resolve)
                    .output(outputPath)
                    .run();
            });

            // Read and return converted image
            return await fs.promises.readFile(outputPath);
        } catch (error) {
            console.error('Conversion error:', error);
            throw new Error('Failed to convert sticker to image');
        } finally {
            // Cleanup temp files
            await Promise.all([
                fs.promises.unlink(tempPath).catch(() => {}),
                fs.promises.unlink(outputPath).catch(() => {})
            ]);
        }
    }

    /**
     * Converts an animated (or static) WebP sticker buffer into an MP4 video buffer.
     *
     * Why not just pipe the .webp straight into ffmpeg? The prebuilt
     * @ffmpeg-installer/ffmpeg binary does not reliably demux multi-frame
     * (animated) WebP, so ffmpeg errors out on most WhatsApp animated stickers.
     *
     * Fix: use `sharp` (libvips) to decode the animated WebP into individual
     * PNG frames — sharp handles animated WebP natively and reliably — then
     * hand those frames to ffmpeg purely for video *encoding* (no WebP
     * decoding required from ffmpeg at all).
     */
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

            // Get raw pixel data for every page/frame stacked vertically
            const { data, info } = await img
                .raw()
                .ensureAlpha()
                .toBuffer({ resolveWithObject: true });

            const channels = info.channels; // 4 (RGBA) since we called ensureAlpha()
            const frameBytes = width * pageHeight * channels;

            // Work out fps from the WebP's per-frame delay (ms). Default to
            // a sane 15fps if delay metadata isn't available (static image).
            let fps = 15;
            if (Array.isArray(metadata.delay) && metadata.delay.length) {
                const avgDelayMs =
                    metadata.delay.reduce((a, b) => a + b, 0) / metadata.delay.length;
                if (avgDelayMs > 0) {
                    fps = Math.min(30, Math.max(1, Math.round(1000 / avgDelayMs)));
                }
            }

            // Slice out each frame and write it as a PNG
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

            // Encode the PNG sequence into an MP4 (ffmpeg never touches WebP here)
            await new Promise((resolve, reject) => {
                ffmpeg()
                    .input(path.join(framesDir, 'frame_%05d.png'))
                    .inputFPS(fps)
                    .outputOptions([
                        '-c:v', 'libx264',
                        '-pix_fmt', 'yuv420p',
                        '-movflags', '+faststart',
                        // libx264 requires even width/height
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
