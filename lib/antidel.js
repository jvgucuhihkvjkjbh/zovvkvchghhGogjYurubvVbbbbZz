const { isJidGroup } = require('@whiskeysockets/baileys');
const { loadMessage } = require('../data');
const config = require('../config');

const messageStore = new Map();

const storeMessage = (message) => {
    if (!message?.key?.id) return;
    messageStore.set(message.key.id, {
        message,
        jid: message.key.remoteJid
    });
    setTimeout(() => messageStore.delete(message.key.id), 30 * 60 * 1000);
};

const DeletedText = async (conn, mek, jid, deleteInfo, isGroup, update) => {
    const messageContent = mek.message?.conversation || mek.message?.extendedTextMessage?.text || 'Unknown content';
    deleteInfo += `\n◈ Content ━ ${messageContent}`;

    await conn.sendMessage(jid, {
        text: deleteInfo,
        contextInfo: {
            mentionedJid: isGroup
                ? [update.key.participant, mek.key.participant].filter(Boolean)
                : [update.key.remoteJid],
        },
    }, { quoted: mek });
};

const DeletedMedia = async (conn, mek, jid, deleteInfo) => {
    try {
        const antideletedmek = structuredClone(mek.message);
        const messageType = Object.keys(antideletedmek)[0];

        if (antideletedmek[messageType]) {
            antideletedmek[messageType].contextInfo = {
                stanzaId: mek.key.id,
                participant: mek.sender,
                quotedMessage: mek.message,
            };
        }

        if (messageType === 'imageMessage' || messageType === 'videoMessage') {
            antideletedmek[messageType].caption = deleteInfo;
        } else if (
            messageType === 'audioMessage' ||
            messageType === 'documentMessage' ||
            messageType === 'stickerMessage'
        ) {
            await conn.sendMessage(jid, {
                text: `*⚠️ Deleted Message Alert 🚨*\n${deleteInfo}`
            }, { quoted: mek });
        }

        await conn.relayMessage(jid, antideletedmek, {});
    } catch (e) {
        await conn.sendMessage(jid, {
            text: `*⚠️ Deleted Message Alert 🚨*\n${deleteInfo}\n\n_Media could not be recovered._`
        });
    }
};

const AntiDelete = async (conn, updates) => {
    for (const update of updates) {

        const antiDeleteStatus = config.ANTI_DELETE === "true" || config.ANTI_DELETE === true;
        if (!antiDeleteStatus) continue;

        if (update.update.message === null) {
            try {

                let storedData = messageStore.get(update.key.id);
                if (!storedData) {
                    const dbMsg = await loadMessage(update.key.id);
                    if (dbMsg) storedData = { message: dbMsg.message, jid: dbMsg.jid };
                }
                if (!storedData) continue;

                const mek = storedData.message;
                const storedJid = storedData.jid || update.key.remoteJid;
                const isGroup = isJidGroup(storedJid);

                const now = new Date();
                const karachiTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Karachi" }));

                const deleteTime = karachiTime.toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true
                });

                let deleteInfo, jid;

                if (isGroup) {
                    const groupMetadata = await conn.groupMetadata(storedJid).catch(() => ({ subject: 'Unknown Group' }));
                    const groupName = groupMetadata.subject;

                    const sender = (mek.key?.participant || update.key?.participant)?.split('@')[0] || 'Unknown';
                    const deleter = update.key?.participant?.split('@')[0] || 'Unknown';

                    deleteInfo = `*╭────⬡ 🤖 ANTI DELETE ⬡────*
*├♻️ SENDER:* @${sender}
*├👥 GROUP:* ${groupName}
*├⏰ TIME:* ${deleteTime}
*├🗑️ DELETED BY:* @${deleter}
*╰💬 MESSAGE:*`;

                    jid = config.ANTI_DEL_PATH === 'inbox'
                        ? conn.user.id.split(':')[0] + '@s.whatsapp.net'
                        : storedJid;

                } else {

                    const senderNumber = (mek.key?.remoteJid || update.key?.remoteJid)?.split('@')[0] || 'Unknown';
                    const deleterNumber = update.key?.remoteJid?.split('@')[0] || 'Unknown';

                    deleteInfo = `*╭────⬡ 🤖 ANTI DELETE ⬡────*
*├👤 SENDER:* @${senderNumber}
*├⏰ TIME:* ${deleteTime}
*├🗑️ DELETED BY:* @${deleterNumber}
*╰💬 MESSAGE:*`;

                    jid = config.ANTI_DEL_PATH === 'inbox'
                        ? conn.user.id.split(':')[0] + '@s.whatsapp.net'
                        : update.key.remoteJid;
                }

                if (mek.message?.conversation || mek.message?.extendedTextMessage) {
                    await DeletedText(conn, mek, jid, deleteInfo, isGroup, update);
                } else {
                    await DeletedMedia(conn, mek, jid, deleteInfo);
                }

            } catch (e) {
                console.error('AntiDelete error:', e.message);
            }
        }
    }
};

module.exports = { storeMessage, DeletedText, DeletedMedia, AntiDelete };