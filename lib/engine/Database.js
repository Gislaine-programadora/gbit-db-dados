'use strict';

const fs = require('fs');
const path = require('path');
const { Collection } = require('./Collection');
const Transaction = require('./Transaction');
const Schema = require('../schema/Schema');
const paths = require('../utils/paths');
const FileManager = require('../storage/FileManager');
const Serializer = require('../storage/Serializer');

const DB_VERSION = '1.0.0';

class Database {
  /**
   * @param {string} root - diretório raiz do banco de dados no disco.
   */
  constructor(root) {
    this.root = path.resolve(root);
    this._collections = new Map();
    this._activeTransaction = null;
  }

  // ────────────────────────────────────────────
  //  CRIAÇÃO / ABERTURA DO BANCO
  // ────────────────────────────────────────────

  /** Cria a estrutura de diretórios e arquivos de um novo banco de dados. */
  static init(root, { name } = {}) {
    const dbRoot = path.resolve(root);
    paths.ensureDir(dbRoot);
    paths.ensureDir(paths.collectionsDir(dbRoot));
    paths.ensureDir(paths.indexesDir(dbRoot));
    paths.ensureDir(paths.transactionsDir(dbRoot));
    paths.ensureDir(paths.backupsDir(dbRoot));

    const dbFile = paths.databaseFile(dbRoot);
    if (!FileManager.exists(dbFile)) {
      FileManager.writeRaw(
        dbFile,
        Serializer.serialize({
          name: name || path.basename(dbRoot),
          version: DB_VERSION,
          engine: 'gbit-db-dados',
          createdAt: new Date().toISOString(),
        })
      );
    }

    const metaFile = paths.metadataFile(dbRoot);
    if (!FileManager.exists(metaFile)) {
      FileManager.writeRaw(
        metaFile,
        Serializer.serialize({
          collections: {},
          lastOpenedAt: new Date().toISOString(),
        })
      );
    }

    return new Database(dbRoot);
  }

  /** Abre um banco existente (ou cria se não existir — comportamento idempotente). */
  static open(root) {
    const dbRoot = path.resolve(root);
    if (!FileManager.exists(paths.databaseFile(dbRoot))) {
      return Database.init(dbRoot);
    }
    return new Database(dbRoot);
  }

  get infoFile() {
    return paths.databaseFile(this.root);
  }

  info() {
    const raw = FileManager.readRaw(this.infoFile);
    return Serializer.deserialize(raw);
  }

  // ────────────────────────────────────────────
  //  COLEÇÕES
  // ────────────────────────────────────────────

  /**
   * Obtém (ou cria) uma coleção. Se `schemaDefinition` for passado na
   * primeira chamada, ele é salvo em metadata.json para ser reaproveitado
   * nas próximas aberturas do banco.
   */
  collection(name, schemaDefinition) {
    if (this._collections.has(name)) {
      return this._collections.get(name);
    }

    const meta = this._readMeta();
    let schema = schemaDefinition;

    if (!schema && meta.collections[name]) {
      schema = Schema.fromJSON(meta.collections[name].schema);
    }

    const col = new Collection(this, name, schema || {});
    this._collections.set(name, col);

    // grava/atualiza metadados da coleção
    meta.collections[name] = meta.collections[name] || {
      createdAt: new Date().toISOString(),
    };
    meta.collections[name].schema = col.schema.toJSON();
    meta.collections[name].uniqueFields = col.schema.uniqueFields;
    this._writeMeta(meta);

    return col;
  }

  listCollections() {
    const meta = this._readMeta();
    return Object.keys(meta.collections);
  }

  dropCollection(name) {
    const col = this.collection(name);
    col.clear();
    FileManager.remove(paths.collectionFile(this.root, name));
    this._collections.delete(name);

    const meta = this._readMeta();
    delete meta.collections[name];
    this._writeMeta(meta);
  }

  _readMeta() {
    const file = paths.metadataFile(this.root);
    if (!FileManager.exists(file)) return { collections: {} };
    return Serializer.deserialize(FileManager.readRaw(file)) || { collections: {} };
  }

  _writeMeta(meta) {
    FileManager.writeRaw(paths.metadataFile(this.root), Serializer.serialize(meta));
  }

  // ────────────────────────────────────────────
  //  TRANSAÇÕES
  // ────────────────────────────────────────────
  transaction() {
    return new Transaction(this);
  }

  /** Atalho: db.transact(() => { ... }) */
  transact(fn) {
    return this.transaction().run(fn);
  }

  // ────────────────────────────────────────────
  //  BACKUP
  // ────────────────────────────────────────────
  backup(label) {
    const stamp = label || new Date().toISOString().replace(/[:.]/g, '-');
    const destDir = path.join(paths.backupsDir(this.root), stamp);
    paths.ensureDir(destDir);

    const collectionsDir = paths.collectionsDir(this.root);
    if (fs.existsSync(collectionsDir)) {
      for (const file of fs.readdirSync(collectionsDir)) {
        FileManager.copyFile(path.join(collectionsDir, file), path.join(destDir, file));
      }
    }
    FileManager.copyFile(paths.metadataFile(this.root), path.join(destDir, 'metadata.json'));
    return destDir;
  }

  stats() {
    const meta = this._readMeta();
    const names = Object.keys(meta.collections);
    return {
      root: this.root,
      collections: names.map((n) => {
        const col = this.collection(n);
        return col.stats();
      }),
    };
  }
}

module.exports = Database;
