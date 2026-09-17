const { cmd } = require('../command');
const { generateMessageID } = require('@whiskeysockets/baileys');

const COLORS = {
  red: 'FF0000', blue: '1DA1F2', green: '25D366', yellow: 'FFD700',
  black: '000000', white: 'FFFFFF', purple: '7B2CBF', pink: 'FFC0CB',
  orange: 'FFA500', cyan: '00FFFF', gray: '808080', navy: '001F5B'
};

const RANDOM_BG = [
  0xFF7B2CBF, 0xFF1D3557, 0xFF2B2D42, 0xFFD90429, 0xFF0077B6,
  0xFF007F5F, 0xFF5A189A, 0xFFE76F51, 0xFF2A9D8F, 0xFF1A1A1D
];

function getRandomBg() {
  return RANDOM_BG[Math.floor(Math.random() * RANDOM_BG.length)];
}

function resolveColor(val) {
  if (!val) return null;
  val = String(val).trim().replace(/^#/, '');
  if (COLORS[val.toLowerCase()]) return COLORS[val.toLowerCase()];
  if (/^[0-9A-Fa-f]{6}$/.test(val)) return val.toUpperCase();
  return null;
}

function parseFlags(text) {
  const result = { textColor: null, bgColor: null, remaining: '' };
  if (!text) return result;

  let cleaned = text
    .replace(/[-–—]?\s*color\s*[:\-]?\s*/gi, ' -color ')
    .replace(/[-–—]?\s*bg\s*[:\-]?\s*/gi, ' -bg ')
    .replace(/\s+/g, ' ')
    .trim();

  const tokens = cleaned.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  const leftover = [];

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i].replace(/^"|"$/g, '');
    const lower = tok.toLowerCase();

    if ((lower === '-color' || lower === 'color') && tokens[i + 1]) {
      const c = resolveColor(tokens[++i].replace(/^"|"$/g, ''));
      if (c) result.textColor = c;
      continue;
    }
    if ((lower === '-bg' || lower === 'bg') && tokens[i + 1]) {
      const c = resolveColor(tokens[++i].replace(/^"|"$/g, ''));
      if (c) result.bgColor = c;
      continue;
    }
    leftover.push(tok);
  }

  result.remaining = leftover.join(' ').trim();
  return result;
}

function buildColoredTextMessage(caption, textColor, bgColor, mentionedJid) {
  let textHex = textColor ? String(textColor).replace('#', '') : 'FFFFFF';
  if (textHex.length === 6) textHex = 'FF' + textHex;

  let bgArgb;
  if (bgColor) {
    let bgHex = String(bgColor).replace('#', '');
    if (bgHex.length === 6) bgHex = 'FF' + bgHex;
    bgArgb = parseInt(bgHex, 16);
  } else {
    bgArgb = getRandomBg();
  }

  return {
    extendedTextMessage: {
      text: caption,
      textArgb: parseInt(textHex, 16),
      backgroundArgb: bgArgb,
      font: 1,
      contextInfo: {
        isGroupStatus: true,
        mentionedJid
      }
    }
  };
}

cmd({
    pattern: "gstatus",
    alias: ["statusgc", "broadcastgc", "gsall"],
    desc: "Broadcast a status (text or media) to ALL groups the bot is in, mentioning all members.",
    category: "group",
    react: "📡",
    filename: __filename
}, async (conn, mek, m, { from, text, reply, isCreator }) => {

    // ── Owner only ──────────────────────────────────────────────────────────
    if (!isCreator) {
        return reply("❌ This command is only for the *bot owner*!");
    }

    try {
        const flags = parseFlags(text || '');
        const caption = flags.remaining;
        const quotedMsg = m.quoted;
        const mimeType = quotedMsg
            ? (quotedMsg.msg || quotedMsg).mimetype || ""
            : "";

        // ── Must have something to send ─────────────────────────────────────
        if (!quotedMsg && !caption) {
            return reply(
                `📡 *Broadcast Status — Usage:*\n\n` +
                `*Text only:*\n` +
                `  \`.gstatus Hello everyone! 🎉\`\n\n` +
                `*Text with color:*\n` +
                `  \`.gstatus Hello -color red -bg black\`\n\n` +
                `*Media + caption:*\n` +
                `  Reply to an image/video with \`.gstatus Your caption here\`\n\n` +
                `*Media without caption:*\n` +
                `  Reply to any media with \`.gstatus\`\n\n` +
                `━━━━━━━━━━━━━━━━━━\n` +
                `~ *ADEEL-MD*`
            );
        }

        // ── Fetch all groups the bot is in ──────────────────────────────────
        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

        const allChats = await conn.groupFetchAllParticipating();
        const allGroups = Object.values(allChats);

        if (!allGroups || allGroups.length === 0) {
            return reply("❌ The bot is not in any groups right now.");
        }

        // ── Download media once (if any) ────────────────────────────────────
        let mediaBuffer = null;
        if (quotedMsg) {
            mediaBuffer = await quotedMsg.download();
            if (!mediaBuffer) {
                return reply("❌ Failed to download the media. Please try again.");
            }
        }

        // ── Helper: detect message type from mimeType or fallback ───────────
        const getMsgType = () => {
            if (mimeType.startsWith("image/")) return "image";
            if (mimeType.startsWith("video/")) return "video";
            if (mimeType.startsWith("audio/")) return "audio";
            const msgType = Object.keys(quotedMsg?.message || {})[0] || "";
            if (msgType === "imageMessage") return "image";
            if (msgType === "videoMessage") return "video";
            if (msgType === "audioMessage" || msgType === "pttMessage") return "audio";
            return null;
        };

        const isPTT =
            quotedMsg?.message?.audioMessage?.ptt ||
            Object.keys(quotedMsg?.message || {})[0] === "pttMessage" ||
            false;

        // ── Broadcast to every group ────────────────────────────────────────
        let successCount = 0;
        let failCount = 0;

        for (const group of allGroups) {
            const groupId = group.id;

            try {
                const mentionedJid = (group.participants || []).map(p => p.id);

                if (mediaBuffer) {
                    const msgType = getMsgType();
                    const contextInfo = { isGroupStatus: true, mentionedJid };
                    let messageContent = {};

                    if (msgType === "image") {
                        messageContent = {
                            image: mediaBuffer,
                            caption: caption || "",
                            mimetype: mimeType || "image/jpeg",
                            contextInfo
                        };
                    } else if (msgType === "video") {
                        messageContent = {
                            video: mediaBuffer,
                            caption: caption || "",
                            mimetype: mimeType || "video/mp4",
                            contextInfo
                        };
                    } else if (msgType === "audio") {
                        messageContent = {
                            audio: mediaBuffer,
                            mimetype: isPTT ? "audio/ogg; codecs=opus" : "audio/mp4",
                            ptt: isPTT,
                            contextInfo
                        };
                    } else {
                        failCount++;
                        continue;
                    }

                    await conn.sendMessage(groupId, messageContent);
                } else {
                    // Text status with color/bg (same mechanism as the single-group status command)
                    const coloredMsg = buildColoredTextMessage(caption, flags.textColor, flags.bgColor, mentionedJid);
                    await conn.relayMessage(groupId, coloredMsg, {
                        messageId: generateMessageID()
                    });
                }

                successCount++;

                // Small delay between sends to avoid rate-limiting
                await new Promise(r => setTimeout(r, 800));

            } catch (groupErr) {
                console.error(`Broadcast failed for group ${groupId}:`, groupErr.message);
                failCount++;
            }
        }

        // ── Done — send summary ─────────────────────────────────────────────
        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });

        reply(
            `✅ *Broadcast Complete!*\n\n` +
            `📡 *Total Groups:* ${allGroups.length}\n` +
            `✔️ *Sent Successfully:* ${successCount}\n` +
            `❌ *Failed:* ${failCount}\n\n` +
            `━━━━━━━━━━━━━━━━━━\n` +
            `~ *ADEEL-MD*`
        );

    } catch (error) {
        console.error("BroadcastStatus Error:", error);
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply(`❌ *Error:* ${error.message}`);
    }
});
