const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

ffmpeg.setFfmpegPath(ffmpegPath);

const createTempFile = (ext) => {
    return path.join(
        os.tmpdir(),
        `${crypto.randomBytes(6).toString('hex')}.${ext}`
    );
};

async function videoToWebp(videoBuffer) {

    const inputPath = createTempFile('mp4');
    const outputPath = createTempFile('webp');

    fs.writeFileSync(inputPath, videoBuffer);

    try {

        await new Promise((resolve, reject) => {

            ffmpeg(inputPath)
                .inputOptions([
                    '-t 6'
                ])
                .outputOptions([
                    '-vcodec libwebp',
                    '-vf scale=320:320:force_original_aspect_ratio=decrease,fps=15',
                    '-loop 0',
                    '-preset default',
                    '-an',
                    '-vsync 0'
                ])
                .toFormat('webp')
                .on('end', resolve)
                .on('error', reject)
                .save(outputPath);

        });

        return fs.readFileSync(outputPath);

    } catch (err) {

        throw new Error(`WebP conversion failed: ${err.message}`);

    } finally {

        if (fs.existsSync(inputPath)) {
            fs.unlinkSync(inputPath);
        }

        if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
        }

    }
}

module.exports = {
    videoToWebp
};
