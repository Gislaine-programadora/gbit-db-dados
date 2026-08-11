'use strict';

/**
 * ═══════════════════════════════════════════════════════════════
 *  EXEMPLO REAL: Backend de Login usando gbit-db-dados
 * ═══════════════════════════════════════════════════════════════
 *
 * Um servidor HTTP puro (sem Express, sem dependências) que implementa:
 *   POST /register  -> cria usuário (senha com hash + salt via crypto nativo)
 *   POST /login     -> autentica e devolve um token de sessão
 *   GET  /me         -> retorna dados do usuário autenticado (via token)
 *   POST /logout     -> invalida o token
 *
 * Rodar:
 *   node examples/login-backend.js
 *
 * Testar:
 *   curl -X POST localhost:3000/register -d '{"email":"a@a.com","password":"123456","name":"Ana"}'
 *   curl -X POST localhost:3000/login    -d '{"email":"a@a.com","password":"123456"}'
 *   curl localhost:3000/me -H "Authorization: Bearer <token>"
 */

const http = require('http');
const crypto = require('crypto');
const gbit = require('../lib/index');

// ── BANCO DE DADOS ──────────────────────────────
const db = gbit.open('./example-db');

const users = db.collection('users', {
  name: { type: 'string', required: true, minLength: 2 },
  email: { type: 'string', required: true, unique: true, format: 'email' },
  passwordHash: { type: 'string', required: true },
  salt: { type: 'string', required: true },
  role: { type: 'string', default: 'user', enum: ['user', 'admin'] },
});

const sessions = db.collection('sessions', {
  token: { type: 'string', required: true, unique: true },
  userId: { type: 'string', required: true },
  expiresAt: { type: 'string', required: true },
});

// índice extra para lookup rápido de sessão por token (além do unique já criado pelo schema)
sessions.createIndex('token', { unique: true });

// ── HASH DE SENHA (scrypt nativo do Node — sem bcrypt externo) ──
function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function createPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(password, salt);
  return { salt, passwordHash };
}

function verifyPassword(password, salt, passwordHash) {
  const attempt = hashPassword(password, salt);
  const a = Buffer.from(attempt, 'hex');
  const b = Buffer.from(passwordHash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ── SESSÕES ──────────────────────────────────────
const SESSION_TTL_MS = 1000 * 60 * 60 * 2; // 2 horas

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  sessions.insert({ token, userId, expiresAt });
  return token;
}

function getUserFromToken(token) {
  if (!token) return null;
  const session = sessions.findByIndex('token', token);
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    sessions.deleteById(session._id);
    return null;
  }
  return users.findById(session.userId);
}

// ── HELPERS HTTP ─────────────────────────────────
function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function getBearerToken(req) {
  const header = req.headers['authorization'] || '';
  const [, token] = header.split(' ');
  return token;
}

function publicUser(user) {
  const { passwordHash, salt, ...safe } = user;
  return safe;
}

// ── ROTAS ────────────────────────────────────────
async function handleRegister(req, res) {
  const body = await readBody(req);
  const { email, password, name } = body;

  if (!email || !password || !name) {
    return sendJson(res, 400, { error: 'Campos obrigatórios: name, email, password' });
  }
  if (password.length < 6) {
    return sendJson(res, 400, { error: 'Senha deve ter no mínimo 6 caracteres' });
  }

  const { salt, passwordHash } = createPasswordHash(password);

  try {
    const user = users.insert({ name, email, salt, passwordHash });
    const token = createSession(user._id);
    return sendJson(res, 201, { user: publicUser(user), token });
  } catch (err) {
    if (err.name === 'DuplicateKeyError') {
      return sendJson(res, 409, { error: 'E-mail já cadastrado' });
    }
    if (err.name === 'ValidationError') {
      return sendJson(res, 400, { error: err.message, details: err.errors });
    }
    return sendJson(res, 500, { error: 'Erro interno' });
  }
}

async function handleLogin(req, res) {
  const body = await readBody(req);
  const { email, password } = body;

  if (!email || !password) {
    return sendJson(res, 400, { error: 'Campos obrigatórios: email, password' });
  }

  // findByIndex usa o índice único de email -> lookup O(1), não varre a coleção inteira
  const user = users.findByIndex('email', email);
  if (!user) {
    return sendJson(res, 401, { error: 'Credenciais inválidas' });
  }

  const ok = verifyPassword(password, user.salt, user.passwordHash);
  if (!ok) {
    return sendJson(res, 401, { error: 'Credenciais inválidas' });
  }

  const token = createSession(user._id);
  return sendJson(res, 200, { user: publicUser(user), token });
}

async function handleMe(req, res) {
  const token = getBearerToken(req);
  const user = getUserFromToken(token);
  if (!user) return sendJson(res, 401, { error: 'Não autenticado' });
  return sendJson(res, 200, { user: publicUser(user) });
}

async function handleLogout(req, res) {
  const token = getBearerToken(req);
  const session = token ? sessions.findByIndex('token', token) : null;
  if (session) sessions.deleteById(session._id);
  return sendJson(res, 200, { ok: true });
}

// ── SERVIDOR ─────────────────────────────────────
const server = http.createServer(async (req, res) => {
  try {
    const { method, url } = req;
    if (method === 'POST' && url === '/register') return await handleRegister(req, res);
    if (method === 'POST' && url === '/login') return await handleLogin(req, res);
    if (method === 'GET' && url === '/me') return await handleMe(req, res);
    if (method === 'POST' && url === '/logout') return await handleLogout(req, res);

    sendJson(res, 404, { error: 'Rota não encontrada' });
  } catch (err) {
    sendJson(res, 500, { error: err.message });
  }
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`✓ Login backend (gbit-db-dados) rodando em http://localhost:${PORT}`);
    console.log(`  Banco de dados em: ${db.root}`);
  });
}

module.exports = server;
