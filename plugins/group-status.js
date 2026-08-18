const { generateWAMessageContent, generateMessageID, downloadMediaMessage, generateWAMessageFromContent } = require('@whiskeysockets/baileys');
const { cmd } = require("../command");
const config = require('../config');
const axios = require('axios');
const cheerio = require('cheerio');

// ─────────────────────────────────────────────────────────────────────────────
// 🔐 COMPLETE PROTOBUF MONKEY-PATCH: Preserve StatusAudienceMetadata
// ─────────────────────────────────────────────────────────────────────────────
(function patchProtobufForStatusAudienceMetadata() {
  try {
    const baileys = require('@whiskeysockets/baileys');
    const WAProto = baileys.proto || baileys.WAProto;
    if (!WAProto || !WAProto.ContextInfo) return;

    if (WAProto.ContextInfo.StatusAudienceMetadata) {
      const SAM = WAProto.ContextInfo.StatusAudienceMetadata;
      if (!SAM._isFullyPatched) {
        const origFromObject = SAM.fromObject;
        SAM.fromObject = function (d) {
          if (d instanceof SAM) return d;
          const m = typeof origFromObject === 'function' ? origFromObject(d) : new SAM();
          if (d.audienceType != null) {
            m.audienceType = typeof d.audienceType === 'number' ? d.audienceType : (d.audienceType === 'CLOSE_FRIENDS' ? 1 : 2);
          }
          if (d.customName != null) m.customName = String(d.customName);
          if (d.customEmoji != null) m.customEmoji = String(d.customEmoji);
          if (d.groupJid != null) m.groupJid = String(d.groupJid);
          return m;
        };

        SAM.encode = function (m, w) {
          if (!w) {
            const protobuf = require('protobufjs/minimal');
            w = protobuf.Writer.create();
          }
          if (m.audienceType != null) w.uint32(8).int32(m.audienceType);
          if (m.customName != null) w.uint32(18).string(m.customName);
          if (m.customEmoji != null) w.uint32(26).string(m.customEmoji);
          if (m.groupJid != null) w.uint32(34).string(m.groupJid);
          return w;
        };

        SAM.decode = function (r, l) {
          const protobuf = require('protobufjs/minimal');
          if (!(r instanceof protobuf.Reader)) r = protobuf.Reader.create(r);
          const c = l === undefined ? r.len : r.pos + l;
          const m = new SAM();
          while (r.pos < c) {
            const t = r.uint32();
            switch (t >>> 3) {
              case 1: m.audienceType = r.int32(); break;
              case 2: m.customName = r.string(); break;
              case 3: m.customEmoji = r.string(); break;
              case 4: m.groupJid = r.string(); break;
              default: r.skipType(t & 7); break;
            }
          }
          return m;
        };

        SAM.toObject = function (m, o) {
          const d = {};
          if (m.audienceType != null) d.audienceType = m.audienceType;
          if (m.customName != null) d.customName = m.customName;
          if (m.customEmoji != null) d.customEmoji = m.customEmoji;
          if (m.groupJid != null) d.groupJid = m.groupJid;
          return d;
        };

        SAM._isFullyPatched = true;
      }
    }
  } catch (e) {
    console.error('[STATUS AUDIENCE PROTO PATCH ERROR]', e.message);
  }
})();

// ── Color Constants ──────────────────────────────────────────────────────────
const COLORS = {
  merah: 'FF0000',
  hijau: '00FF00',
  biru: '0000FF',
  kuning: 'FFFF00',
  hitam: '000000',
  putih: 'FFFFFF',
  ungu: '800080',
  pink: 'FFC0CB',
  orange: 'FFA500',
  cyan: '00FFFF',
  black: '000000',
  white: 'FFFFFF',
  red: 'FF0000',
  blue: '1DA1F2',
  green: '25D366',
  yellow: 'FFD700',
  purple: '7B2CBF',
  gray: '808080',
  navy: '001F5B'
};

const RANDOM_BG_COLORS = [
  0xFF7B2CBF, // Purple
  0xFF1D3557, // Navy
  0xFF2B2D42, // Charcoal Blue
  0xFFD90429, // Crimson Red
  0xFF0077B6, // Ocean Blue
  0xFF007F5F, // Emerald Green
  0xFF5A189A, // Royal Violet
  0xFF6B705C, // Olive Earth
  0xFFE76F51, // Terracotta Orange
  0xFF2A9D8F, // Teal
  0xFF3D348B, // Indigo
  0xFF6A040F, // Dark Burgundy
  0xFF3F37C9, // Electric Indigo
  0xFF03045E, // Midnight Blue
  0xFF1A1A1D, // Onyx Black
];

function getRandomArgbColor() {
  return RANDOM_BG_COLORS[Math.floor(Math.random() * RANDOM_BG_COLORS.length)];
}

const FONTS = {
  system: 0,
  sans: 1,
  serif: 2,
  script: 3,
  morning: 4,
  calistoga: 5,
  oswald: 6,
  courier: 7
};

const TYPE_MAP = {
  audioMessage: 'vn',
  videoMessage: 'vid',
  imageMessage: 'img',
  extendedTextMessage: 'txt',
  conversation: 'txt'
};

function getRealMessage(message) {
  if (!message) return null;
  if (message.ephemeralMessage) return getRealMessage(message.ephemeralMessage.message);
  if (message.viewOnceMessage) return getRealMessage(message.viewOnceMessage.message);
  if (message.viewOnceMessageV2) return getRealMessage(message.viewOnceMessageV2.message);
  if (message.viewOnceMessageV2Extension) return getRealMessage(message.viewOnceMessageV2Extension.message);
  if (message.documentWithCaptionMessage) return getRealMessage(message.documentWithCaptionMessage.message);
  return message;
}

function tokenize(input) {
  const tokens = [];
  if (!input) return tokens;

  let current = '';
  let inQuotes = false;
  let quoteChar = '';

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (inQuotes) {
      if (ch === quoteChar) {
        tokens.push(current);
        current = '';
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"' || ch === "'") {
        inQuotes = true;
        quoteChar = ch;
      } else if (/\s/.test(ch)) {
        if (current) {
          tokens.push(current);
          current = '';
        }
      } else {
        current += ch;
      }
    }
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

function parseSwgcFlags(rawText) {
  const tokens = tokenize(rawText);
  const result = {
    isSilent: false,
    useLinkPreview: false,
    customLink: null,
    textColor: null,
    bgColor: null,
    textFont: null,
    customName: null,
    customEmoji: null,
    customCaption: null,
    useAiBadge: false,
    remaining: [],
  };

  const SILENT_FLAGS = new Set(['--s', '-s', '--silent', '-silent']);
  const LINK_FLAGS = new Set(['-link', '--link']);

  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i];
    const lower = tok.toLowerCase();

    if (SILENT_FLAGS.has(lower)) {
      result.isSilent = true;
      i++;
      continue;
    }

    if (lower === '-ai') {
      result.useAiBadge = true;
      i++;
      continue;
    }

    if (LINK_FLAGS.has(lower)) {
      result.useLinkPreview = true;
      const val = tokens[i + 1];
      if (val && /^https?:\/\//i.test(val)) {
        result.customLink = val;
        i += 2;
      } else {
        i += 1;
      }
      continue;
    }

    if (lower === '-color') {
      const val = tokens[i + 1];
      if (val !== undefined) {
        const key = val.toLowerCase();
        result.textColor = COLORS[key] || val;
        i += 2;
      } else {
        i += 1;
      }
      continue;
    }

    if (lower === '-bg') {
      const val = tokens[i + 1];
      if (val !== undefined) {
        const key = val.toLowerCase();
        let raw = COLORS[key] || val;
        if (!raw.startsWith('#') && !raw.startsWith('0x') && !raw.startsWith('0X')) {
          raw = '#' + raw;
        }
        result.bgColor = raw;
        i += 2;
      } else {
        i += 1;
      }
      continue;
    }

    if (lower === '-font') {
      const val = tokens[i + 1];
      if (val !== undefined) {
        const key = val.toLowerCase();
        let f = FONTS[key] !== undefined ? FONTS[key] : parseInt(val, 10);
        result.textFont = isNaN(f) ? null : f;
        i += 2;
      } else {
        i += 1;
      }
      continue;
    }

    if (lower === '-t') {
      const val = tokens[i + 1];
      if (val !== undefined) {
        result.customName = val;
        i += 2;
      } else {
        i += 1;
      }
      continue;
    }

    if (lower === '-e') {
      const val = tokens[i + 1];
      if (val !== undefined) {
        result.customEmoji = val;
        i += 2;
      } else {
        i += 1;
      }
      continue;
    }

    if (lower === '-c') {
      const val = tokens[i + 1];
      if (val !== undefined) {
        result.customCaption = val;
        i += 2;
      } else {
        i += 1;
      }
      continue;
    }

    result.remaining.push(tok);
    i++;
  }

  return result;
}

function isUnsafeLinkTarget(urlStr) {
  try {
    const u = new URL(urlStr);
    if (!/^https?:$/.test(u.protocol)) return true;
    const host = u.hostname.toLowerCase();
    if (host === 'localhost' || host === '0.0.0.0' || host === '::1' || host === '169.254.169.254') return true;
    return false;
  } catch {
    return true;
  }
}

async function fetchLinkPreview(url) {
  try {
    const res = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 WhatsApp/2.23.20.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    });

    const $ = cheerio.load(res.data);
    const title = $('meta[property="og:title"]').attr('content') ||
                  $('meta[name="twitter:title"]').attr('content') ||
                  $('title').text() || '';

    const description = $('meta[property="og:description"]').attr('content') ||
                        $('meta[name="twitter:description"]').attr('content') ||
                        $('meta[name="description"]').attr('content') || '';

    let image = $('meta[property="og:image"]').attr('content') ||
                $('meta[name="twitter:image"]').attr('content') ||
                $('meta[property="og:image:secure_url"]').attr('content') || '';

    let jpegThumbnail = null;
    if (image) {
      if (image.startsWith('//')) image = 'https:' + image;
      else if (image.startsWith('/')) {
        const u = new URL(url);
        image = `${u.protocol}//${u.host}${image}`;
      }
      try {
        const imgRes = await axios.get(image, {
          responseType: 'arraybuffer',
          timeout: 6000,
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        jpegThumbnail = Buffer.from(imgRes.data);
      } catch (e) {
        console.error('[SWGC] Image thumbnail fetch failed:', e.message);
      }
    }

    return {
      title: title.trim(),
      description: description.trim(),
      canonicalUrl: url,
      matchedText: url,
      jpegThumbnail
    };
  } catch (err) {
    console.error('[SWGC] Link preview fetch failed:', err.message);
    return null;
  }
}

async function groupStatus(sock, jid, rawContent, useAiBadge = false, customName = "ADEEL-MD", customEmoji = "🕷️") {
  let waMsgContent;
  const isPreGenerated = !!(rawContent.extendedTextMessage || rawContent.imageMessage || rawContent.videoMessage || rawContent.audioMessage);

  if (isPreGenerated) {
    waMsgContent = { ...rawContent };
    if (waMsgContent.message) {
      waMsgContent.message = { ...waMsgContent.message };
    }
  } else {
    const content = { ...rawContent };
    const { backgroundColor, textColor, textFont, linkPreview } = content;
    delete content.backgroundColor;
    delete content.textColor;
    delete content.textFont;
    delete content.linkPreview;

    const opts = { upload: sock.waUploadToServer };

    waMsgContent = await generateWAMessageContent(content, opts);
    if (!waMsgContent) throw new Error('generateWAMessageContent failed to produce content');

    const innerMsg = waMsgContent.message || waMsgContent;
    if (innerMsg.extendedTextMessage) {
      if (textColor) {
        let hex = String(textColor).replace('#', '');
        if (hex.length === 6) hex = 'FF' + hex;
        innerMsg.extendedTextMessage.textArgb = parseInt(hex, 16);
      } else {
        innerMsg.extendedTextMessage.textArgb = 0xFFFFFFFF;
      }

      if (backgroundColor) {
        let hex = String(backgroundColor).replace('#', '');
        if (hex.length === 6) hex = 'FF' + hex;
        innerMsg.extendedTextMessage.backgroundArgb = parseInt(hex, 16);
      } else {
        innerMsg.extendedTextMessage.backgroundArgb = getRandomArgbColor();
      }

      innerMsg.extendedTextMessage.font = textFont !== undefined && textFont !== null ? textFont : 1;

      if (linkPreview) {
        if (linkPreview.title) innerMsg.extendedTextMessage.title = linkPreview.title;
        if (linkPreview.description) innerMsg.extendedTextMessage.description = linkPreview.description;
        if (linkPreview.canonicalUrl) innerMsg.extendedTextMessage.canonicalUrl = linkPreview.canonicalUrl;
        if (linkPreview.matchedText) innerMsg.extendedTextMessage.matchedText = linkPreview.matchedText;
        if (linkPreview.jpegThumbnail) {
          innerMsg.extendedTextMessage.jpegThumbnail = Buffer.isBuffer(linkPreview.jpegThumbnail)
            ? linkPreview.jpegThumbnail
            : Buffer.from(linkPreview.jpegThumbnail);
        }
        innerMsg.extendedTextMessage.previewType = 0;
      }
    }
  }

  const innerMsg = waMsgContent.message || waMsgContent;
  const msgKey = Object.keys(innerMsg).find(k => innerMsg[k] && typeof innerMsg[k] === 'object' && k !== 'messageContextInfo');

  if (msgKey) {
    innerMsg[msgKey] = { ...innerMsg[msgKey] };
    innerMsg[msgKey].contextInfo = { ...(innerMsg[msgKey].contextInfo || {}) };

    innerMsg[msgKey].contextInfo.isGroupStatus = true;
    innerMsg[msgKey].contextInfo.featureEligibilities = {
      canReceiveMultiReact: true
    };
    innerMsg[msgKey].contextInfo.statusAttributions = [
      {
        type: 10
      }
    ];
    innerMsg[msgKey].contextInfo.pairedMediaType = 0;

    if (innerMsg.imageMessage) innerMsg[msgKey].contextInfo.statusSourceType = 0;
    else if (innerMsg.videoMessage) innerMsg[msgKey].contextInfo.statusSourceType = 1;
    else if (innerMsg.audioMessage) innerMsg[msgKey].contextInfo.statusSourceType = 3;
    else if (innerMsg.extendedTextMessage) innerMsg[msgKey].contextInfo.statusSourceType = 4;

    innerMsg[msgKey].contextInfo.statusAudienceMetadata = {
      audienceType: 2,
      customName: customName || "ADEEL-MD",
      customEmoji: customEmoji || "🕷️"
    };
  }

  const finalMsg = {
    senderKeyDistributionMessage: {
      groupId: jid,
      axolotlSenderKeyDistributionMessage: Buffer.from(
        "Mwjhu6XDBBApGiCz3ID71WBT/zyUkiLBlCAdfeVSU1hAs5tqPa+RimyiFCIhBfV5TqdCa4w9ekdTm1BAiUSQa+26MVVXXv7i45SBR3sj",
        "base64"
      )
    },
    groupStatusMessageV2: { message: innerMsg }
  };

  const messageId = generateMessageID();
  const relayOpts = {
    messageId,
    additionalNodes: [
      {
        tag: "meta",
        attrs: {
          is_group_status: "true"
        }
      }
    ]
  };

  if (useAiBadge) {
    relayOpts.additionalNodes.push({
      tag: 'bot',
      attrs: { biz_bot: '1' }
    });
  }

  await sock.relayMessage(jid, finalMsg, relayOpts);
}

async function sendSuccessConfirmation(sock, from, mek, mediaType, botName = "ADEEL-MD", participantCount = 1) {
  try {
    const typeLabel = mediaType === 'img' ? 'Image' : mediaType === 'vid' ? 'Video' : mediaType === 'vn' ? 'Audio' : 'Text';

    const statusText = `> 📢 *S T A T U S   S E N T*
> ​ㅤ
> 📊 *Type:* _${typeLabel}_
> ​ㅤ
> ✨ *Story:* _Published successfully to group!_`.trim();

    const safeParticipantCount = Math.min(Math.max(participantCount || 1, 1), 256);
    const dummyContacts = Array.from({ length: safeParticipantCount }, (_, i) => ({
      displayName: `M ${i}`,
      vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:M ${i}\nTEL;type=CELL;type=VOICE;waid=1000${i}:+1000${i}\nEND:VCARD`
    }));

    const fakeStatusQuote = {
      key: {
        fromMe: false,
        participant: '0@s.whatsapp.net',
        remoteJid: 'status@broadcast',
        id: 'STATUS-' + Math.random().toString(36).substring(2).toUpperCase()
      },
      message: {
        contactsArrayMessage: {
          displayName: `${botName}`,
          contacts: dummyContacts
        }
      }
    };

    const interactiveContent = {
      body: { text: statusText },
      footer: { text: `${botName} • Status Info` },
      nativeFlowMessage: {
        buttons: [
          {
            name: 'cta_copy',
            buttonParamsJson: JSON.stringify({
              display_text: 'Sukses',
              copy_code: 'Sukses'
            })
          }
        ]
      }
    };

    const msgContent = {
      viewOnceMessage: {
        message: {
          messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2
          },
          interactiveMessage: interactiveContent
        }
      }
    };

    const userJid = sock.authState?.creds?.me?.id || sock.user?.id;
    const fullMsg = generateWAMessageFromContent(from, msgContent, {
      userJid,
      quoted: fakeStatusQuote
    });

    const ifPath = fullMsg.message?.viewOnceMessage?.message?.interactiveMessage;
    if (ifPath) {
      ifPath.contextInfo = {
        ...(ifPath.contextInfo || {}),
        isForwarded: false,
        forwardingScore: 999,
        forwardedNewsletterMessageInfo: {
          newsletterJid: '120363233827255152@newsletter',
          serverMessageId: 1,
          newsletterName: botName
        }
      };
    }

    const additionalNodes = [{
      tag: 'biz',
      attrs: {},
      content: [{
        tag: 'interactive',
        attrs: { v: '1', type: 'native_flow' },
        content: [{
          tag: 'native_flow',
          attrs: { v: '9', name: 'mixed' }
        }]
      }]
    }];

    await sock.relayMessage(from, fullMsg.message, {
      messageId: fullMsg.key.id,
      additionalNodes
    });

  } catch (err) {
    console.error('[SWGC CONFIRMATION ERROR]', err.message);
    try {
      if (mek?.key) {
        await sock.sendMessage(from, { react: { text: '✅', key: mek.key } });
      }
    } catch {}
  }
}

const HELP_TEXT = (botPrefix) =>
`*📝 HOW TO USE:*
> 1. Send or pick a message *text/image/video/voice*
> 2. Reply to that message with \`${botPrefix}groupstatus\`

*⚙️ GLOBAL FLAGS - ALL TYPES*
> \`--s\` / \`-s\` / \`--silent\` *- Silent mode, no notification*
> \`-ai\` *- Add AI badge*
> \`-t "Name"\` *- Custom author name*
> \`-e "Emoji"\` *- Custom author emoji*
> \`-c "Caption"\` *- Custom caption for all except audio*

*🎨 TEXT ONLY FLAGS*
> \`-link [URL]\` / \`--link [URL]\` *- Force link preview*
> \`-color [hex/name]\` *- Text color*
> \`-bg [hex/name]\` *- Background color*
> \`-font [0-7]\` *- Change text font*

*💡 INFO*
> ℹ️ *Auto Preview:* URL in text = auto link preview. Use \`-link\` only to force different URL.
> ​ㅤ
> ℹ️ *Quotes:* Use quotes for spaces: \`${botPrefix}groupstatus Hello -t "adeel-md"\`
> ​ㅤ
> ℹ️ *Combo:* Flags can mix: \`${botPrefix}groupstatus -c "join" -e "🌷" -t "adeel-md" -ai --s https://example.com\`
> ​ㅤ
> ℹ️ *Target Group:* Send to specific group: \`${botPrefix}groupstatus 120363xxxxxxxxx@g.us Hello there\`

*🆕 MULTI-STATUS MODE:*
> \`${botPrefix}groupstatus COUNT GROUPJID [flags] [text]\`
> ​ㅤ
> Example: \`${botPrefix}groupstatus 10 120363xxxxxxxx@g.us Hello\``;

cmd({
    pattern: "groupstatus",
    alias: ["gst", "swgc", "group-status", "gstatus"],
    desc: "Send Group Status V2 (reply to media or text)",
    category: "group",
    react: "📢",
    filename: __filename
}, async (conn, mek, m, { from, quoted, q, reply }) => {
    let flags;
    try {
      flags = parseSwgcFlags(q || '');
      const isSilent = flags.isSilent;
      const customName = flags.customName || "ADEEL-MD";
      const customEmoji = flags.customEmoji || "🕷️";
      const useAiBadge = flags.useAiBadge;
      const botPrefix = require('../config').PREFIX;

      const react = async (emoji) => {
        try { await conn.sendMessage(from, { react: { text: emoji, key: mek.key } }); } catch {}
      };

      // ── MULTI-STATUS / TARGET JID DETECTION ─────────────────────────────────
      let count = 1;
      let targetJid = null;
      let remainingTokens = [...flags.remaining];

      if (remainingTokens.length >= 2 && /^\d+$/.test(remainingTokens[0]) && remainingTokens[1].endsWith('@g.us')) {
        count = Math.min(Math.max(parseInt(remainingTokens[0], 10), 1), 50);
        targetJid = remainingTokens[1];
        remainingTokens = remainingTokens.slice(2);
      } else {
        const jidTokenIndex = remainingTokens.findIndex(tok => tok.endsWith('@g.us'));
        if (jidTokenIndex !== -1) {
          targetJid = remainingTokens[jidTokenIndex];
          remainingTokens = remainingTokens.filter((_, i) => i !== jidTokenIndex);
        }
      }

      const jid = targetJid || from;
      if (!jid.endsWith('@g.us')) {
        if (!isSilent && reply) return reply("⚠️ *Command ini hanya dapat digunakan di dalam grup!*");
        return;
      }

      const cleanArgs = remainingTokens.join(' ').trim();
      const realQuoted = quoted && Object.keys(quoted).length ? getRealMessage(quoted) : null;

      if (!realQuoted && !cleanArgs && !flags.customCaption && !flags.customLink) {
        if (!isSilent && reply) await reply(HELP_TEXT(botPrefix || '.'));
        return;
      }

      const mtype = realQuoted ? Object.keys(realQuoted).find(k => TYPE_MAP[k]) : null;
      const type = realQuoted ? TYPE_MAP[mtype] : 'txt';

      let captionText = '';
      if (flags.customCaption) {
        captionText = flags.customCaption;
      } else if (realQuoted) {
        captionText = realQuoted.conversation ||
               realQuoted.extendedTextMessage?.text ||
               realQuoted[mtype]?.caption ||
               '';
      } else {
        captionText = cleanArgs;
      }

      const doc = {};

      if (type === 'txt') {
        doc.text = captionText || '';

        const urlRegex = /https?:\/\/[^\s]+/i;
        const autoDetectedUrl = (captionText || '').match(urlRegex)?.[0] || null;
        const shouldPreview = flags.useLinkPreview || !!flags.customLink || !!autoDetectedUrl;

        if (shouldPreview) {
          let targetUrl = flags.customLink || autoDetectedUrl;
          if (targetUrl && !isUnsafeLinkTarget(targetUrl)) {
            if (!doc.text) {
              doc.text = targetUrl;
            } else if (!doc.text.includes(targetUrl)) {
              doc.text = `${doc.text}\n${targetUrl}`;
            }

            const preview = await fetchLinkPreview(targetUrl);
            if (preview) {
              doc.linkPreview = preview;
            }
          }
        }

        if (!doc.text) doc.text = '(empty)';

        if (flags.textColor) doc.textColor = flags.textColor;
        if (flags.bgColor) doc.backgroundColor = flags.bgColor;
        if (flags.textFont !== null) doc.textFont = flags.textFont;

      } else {
        if (!isSilent) await react('⏳');

        const contextInfo = mek?.message?.extendedTextMessage?.contextInfo || {};
        const quotedKey = {
          remoteJid: from,
          fromMe: contextInfo.participant === conn.user?.id || false,
          id: contextInfo.stanzaId || mek?.key?.id,
          participant: contextInfo.participant || mek?.key?.participant || mek?.key?.remoteJid
        };

        const mediaMsg = {
          key: quotedKey,
          message: { [mtype]: realQuoted[mtype] }
        };

        const buffer = await downloadMediaMessage(
          mediaMsg,
          'buffer',
          {},
          { logger: console, reuploadRequest: conn.updateMediaMessage }
        );

        if (type === 'img') {
          doc.image = buffer;
          if (captionText) doc.caption = captionText;
        } else if (type === 'vid') {
          doc.video = buffer;
          if (captionText) doc.caption = captionText;
        } else if (type === 'vn') {
          doc.audio = buffer;
          doc.mimetype = 'audio/mp4';
          doc.ptt = true;
        }
      }

      for (let i = 0; i < count; i++) {
        await groupStatus(conn, jid, doc, useAiBadge, customName, customEmoji);
        if (i < count - 1) {
          await new Promise(r => setTimeout(r, 600));
        }
      }

      if (!isSilent) {
        await react('✅');
        let participantCount = 1;
        try {
          const meta = await conn.groupMetadata(jid);
          if (meta && meta.participants) {
            participantCount = meta.participants.length;
          }
        } catch {}

        await sendSuccessConfirmation(conn, from, mek, type, "ADEEL-MD", participantCount);
      }

    } catch (err) {
      console.error('[GROUP STATUS ERROR]', err);
      if (!flags?.isSilent) {
        try { await conn.sendMessage(from, { react: { text: '❌', key: mek.key } }); } catch {}
        if (reply) await reply(`❌ *Status grup bhejne mein masla hua:* ${err.message}`);
      }
    }
});
