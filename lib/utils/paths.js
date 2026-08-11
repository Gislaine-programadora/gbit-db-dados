'use strict';

const path = require('path');
const fs = require('fs');

/**
 * Resolve o diretório raiz de um banco de dados gbit-db-dados.
 * Procura por um arquivo `database.json` a partir do cwd, subindo diretórios
 * (parecido com o comportamento do package.json / .git).
 */
function findDatabaseRoot(startDir = process.cwd()) {
  let dir = path.resolve(startDir);
  const { root } = path.parse(dir);

  while (true) {
    const candidate = path.join(dir, 'database.json');
    if (fs.existsSync(candidate)) return dir;
    if (dir === root) return null;
    dir = path.dirname(dir);
  }
}

function collectionsDir(dbRoot) {
  return path.join(dbRoot, 'collections');
}

function indexesDir(dbRoot) {
  return path.join(dbRoot, 'indexes');
}

function transactionsDir(dbRoot) {
  return path.join(dbRoot, 'transactions');
}

function backupsDir(dbRoot) {
  return path.join(dbRoot, 'backups');
}

function metadataFile(dbRoot) {
  return path.join(dbRoot, 'metadata.json');
}

function databaseFile(dbRoot) {
  return path.join(dbRoot, 'database.json');
}

function collectionFile(dbRoot, name) {
  return path.join(collectionsDir(dbRoot), `${name}.json`);
}

function indexFile(dbRoot, collectionName, field) {
  return path.join(indexesDir(dbRoot), `${collectionName}.${field}.idx.json`);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

module.exports = {
  findDatabaseRoot,
  collectionsDir,
  indexesDir,
  transactionsDir,
  backupsDir,
  metadataFile,
  databaseFile,
  collectionFile,
  indexFile,
  ensureDir,
};
