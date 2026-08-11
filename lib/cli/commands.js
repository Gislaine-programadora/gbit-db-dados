'use strict';

const path = require('path');
const Database = require('../engine/Database');
const paths = require('../utils/paths');
const logger = require('../utils/logger');
const { printHelp } = require('./help');
const { getVersion } = require('./version');

function requireDatabase() {
  const root = paths.findDatabaseRoot();
  if (!root) {
    logger.error('Nenhum banco de dados encontrado (database.json não localizado).');
    logger.muted('Rode "gbit-db-dados init" primeiro, ou navegue até a pasta do banco.');
    process.exit(1);
  }
  return Database.open(root);
}

function parseJsonArg(str, fallback = {}) {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch (e) {
    logger.error(`JSON inválido: ${e.message}`);
    process.exit(1);
  }
}

const commands = {
  init(args) {
    const target = args[0] || '.';
    const dbRoot = path.resolve(process.cwd(), target);
    const db = Database.init(dbRoot, { name: path.basename(dbRoot) });
    logger.success(`Banco de dados criado em: ${db.root}`);
    logger.muted('Estrutura: collections/ indexes/ transactions/ backups/ database.json metadata.json');
  },

  'create-collection': function createCollection(args) {
    const name = args[0];
    if (!name) {
      logger.error('Uso: gbit-db-dados create-collection <nome>');
      process.exit(1);
    }
    const db = requireDatabase();
    db.collection(name);
    logger.success(`Coleção "${name}" criada.`);
  },

  'list-collections': function listCollections() {
    const db = requireDatabase();
    const names = db.listCollections();
    if (names.length === 0) {
      logger.muted('Nenhuma coleção ainda. Use "create-collection <nome>".');
      return;
    }
    logger.title('Coleções:');
    for (const name of names) {
      const col = db.collection(name);
      logger.raw(`  • ${name}  (${col.count()} documentos)`);
    }
  },

  'drop-collection': function dropCollection(args) {
    const name = args[0];
    if (!name) {
      logger.error('Uso: gbit-db-dados drop-collection <nome>');
      process.exit(1);
    }
    const db = requireDatabase();
    db.dropCollection(name);
    logger.success(`Coleção "${name}" removida.`);
  },

  insert(args) {
    const [name, jsonStr] = args;
    if (!name || !jsonStr) {
      logger.error('Uso: gbit-db-dados insert <coleção> <jsonDocumento>');
      process.exit(1);
    }
    const db = requireDatabase();
    const col = db.collection(name);
    const data = parseJsonArg(jsonStr);
    try {
      const doc = col.insert(data);
      logger.success('Documento inserido:');
      logger.raw(JSON.stringify(doc, null, 2));
    } catch (err) {
      logger.error(err.message);
      process.exit(1);
    }
  },

  find(args) {
    const [name, filterStr] = args;
    if (!name) {
      logger.error('Uso: gbit-db-dados find <coleção> [filtroJson]');
      process.exit(1);
    }
    const db = requireDatabase();
    const col = db.collection(name);
    const filter = parseJsonArg(filterStr, {});
    const results = col.find(filter);
    logger.title(`${results.length} documento(s) encontrado(s):`);
    logger.raw(JSON.stringify(results, null, 2));
  },

  count(args) {
    const [name, filterStr] = args;
    if (!name) {
      logger.error('Uso: gbit-db-dados count <coleção> [filtroJson]');
      process.exit(1);
    }
    const db = requireDatabase();
    const col = db.collection(name);
    const filter = parseJsonArg(filterStr, {});
    logger.raw(String(col.count(filter)));
  },

  stats() {
    const db = requireDatabase();
    const s = db.stats();
    logger.title(`Banco: ${s.root}`);
    if (s.collections.length === 0) {
      logger.muted('Sem coleções ainda.');
      return;
    }
    for (const c of s.collections) {
      logger.raw(`\n  ${logger.paint('bold', c.name)}`);
      logger.raw(`    documentos: ${c.count}`);
      logger.raw(`    índices: ${c.indexes.length ? c.indexes.join(', ') : '(nenhum)'}`);
    }
  },

  backup(args) {
    const db = requireDatabase();
    const dest = db.backup(args[0]);
    logger.success(`Backup criado em: ${dest}`);
  },

  version() {
    logger.raw(getVersion());
  },

  help() {
    printHelp();
  },
};

function run(argv) {
  const [cmd, ...args] = argv;

  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    printHelp();
    return;
  }
  if (cmd === '--version' || cmd === '-v') {
    logger.raw(getVersion());
    return;
  }

  const handler = commands[cmd];
  if (!handler) {
    logger.error(`Comando desconhecido: "${cmd}"`);
    printHelp();
    process.exit(1);
  }

  handler(args);
}

module.exports = { run, commands };
