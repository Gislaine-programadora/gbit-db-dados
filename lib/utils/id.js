'use strict';

const crypto = require('crypto');

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Gera um ID único, curto e ordenável no tempo (estilo ULID simplificado):
 * [timestamp base36][8 chars aleatórios]
 * Exemplo: 1o4x9z3k9f2h8g1a
 */
function generateId() {
  const timePart = Date.now().toString(36);
  const randomBytes = crypto.randomBytes(8);
  let randomPart = '';
  for (let i = 0; i < randomBytes.length; i++) {
    randomPart += ALPHABET[randomBytes[i] % ALPHABET.length];
  }
  return `${timePart}${randomPart}`;
}

/**
 * Gera um UUID v4 padrão (usa crypto.randomUUID nativo do Node >= 14.17).
 */
function generateUUID() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback manual (Node muito antigo)
  const bytes = crypto.randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

module.exports = { generateId, generateUUID };
