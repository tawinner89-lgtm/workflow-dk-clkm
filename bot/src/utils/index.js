"use strict";

function normalizePhone(phone) {
  if (!phone) return "";
  let cleaned = String(phone).replace(/\D/g, "");
  if (cleaned.startsWith("00212")) cleaned = "212" + cleaned.slice(5);
  else if (cleaned.startsWith("0") && cleaned.length === 10) cleaned = "212" + cleaned.slice(1);
  else if (!cleaned.startsWith("212") && cleaned.length === 9) cleaned = "212" + cleaned;
  return cleaned;
}

function normalizePhoneWithSuffix(phone) {
  const n = normalizePhone(phone);
  return n ? n + "@c.us" : "";
}

async function resolveCanonicalChatId(msg) {
  try {
    if (msg.fromMe) {
      const chat = await msg.getChat();
      if (chat && chat.isGroup === false) {
        const contact = await chat.getContact();
        if (contact && contact.number) return normalizePhone(contact.number);
      }
      return normalizePhone(msg.to);
    } else {
      const contact = await msg.getContact();
      if (contact && contact.number) return normalizePhone(contact.number);
      return normalizePhone(msg.from);
    }
  } catch (e) {
    return normalizePhone(msg.fromMe ? msg.to : msg.from);
  }
}

async function canonicalChatKey(msg) {
  return resolveCanonicalChatId(msg);
}

function getMoroccanPhone(phone) {
  if (!phone) return null;
  let c = String(phone).replace(/\D/g, "");
  if (c.startsWith("00212")) c = "0" + c.slice(5);
  else if (c.startsWith("212")) c = "0" + c.slice(3);
  if (/^0[5-7]\d{8}$/.test(c)) {
    return "+212" + c.slice(1);
  }
  return null;
}

function parseBooleanEnv(val) {
  if (!val) return false;
  val = String(val).toLowerCase().trim();
  if (val === "false" || val === "0" || val === "no" || val === "") return false;
  return true;
}

function isCourtesyClosing(text) {
  return /^(merci|chokran|merci beaucoup|شكرا|shokran)$/i.test(text.trim());
}

const currencyRegex = /(?<![\p{L}\p{N}_])(dh|dhs|mad|dirham|dirhams|d\.m|درهم|دراهم|د\.م\.?)(?![\p{L}\p{N}_])/iu;

function checkCurrencyGuard(replyLower) {
  return replyLower.match(currencyRegex);
}

function shouldNotifyTech(oldPayload, newPayload) {
  if (!oldPayload) return true;
  return oldPayload.proposedTime !== newPayload.proposedTime ||
         oldPayload.clientAddress !== newPayload.clientAddress ||
         oldPayload.clientContactPhone !== newPayload.clientContactPhone;
}

module.exports = {
  resolveCanonicalChatId,
  normalizePhone,
  normalizePhoneWithSuffix,
  canonicalChatKey,
  getMoroccanPhone,
  parseBooleanEnv,
  isCourtesyClosing,
  checkCurrencyGuard,
  shouldNotifyTech
};
