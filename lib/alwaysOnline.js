'use strict';

const config = require('../config');

async function PresenceControl(client, presence) {
  if (!client) {
    return;
  }

  if (config.ALWAYS_ONLINE === 'true') {
    await client.sendPresenceUpdate('available');
    return;
  }

  if (!presence || !presence.presences) {
    return;
  }

  const presenceEntries = Object.values(presence.presences);
  const firstPresence = presenceEntries[0];
  const lastKnownPresence = firstPresence && firstPresence.lastKnownPresence;

  if (!lastKnownPresence) {
    return;
  }

  const normalizedStatus =
    lastKnownPresence === 'available' ? 'available' : 'unavailable';

  await client.sendPresenceUpdate(normalizedStatus);
}

function BotActivityFilter(bot) {
  if (!bot) {
    return bot;
  }

  const originalSendMessage = bot.sendMessage;
  const originalSendPresenceUpdate = bot.sendPresenceUpdate;

  bot.sendMessage = async function wrappedSendMessage(...args) {
    const result = await originalSendMessage.apply(this, args);

    if (config.ALWAYS_ONLINE === 'true') {
      return result;
    }

    const autoTypingEnabled = config.AUTO_TYPING === 'true';
    const autoRecordingEnabled = config.AUTO_RECORDING === 'true';

    if (!autoTypingEnabled && !autoRecordingEnabled) {
      await originalSendPresenceUpdate.call(this, 'unavailable');
    }

    return result;
  };

  bot.sendPresenceUpdate = async function wrappedSendPresenceUpdate(...args) {
    if (config.ALWAYS_ONLINE === 'true') {
      return originalSendPresenceUpdate.apply(this, args);
    }

    return undefined;
  };

  return bot;
}

module.exports = {
  PresenceControl,
  BotActivityFilter,
};
