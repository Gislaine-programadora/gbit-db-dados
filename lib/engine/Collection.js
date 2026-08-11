'use strict';

const Storage = require('../storage/Storage');
const Query = require('./Query');
const Index = require('./Index');
const Schema = require('../schema/Schema');
const { Validator, ValidationError } = require('../schema/Validator');
const { generateId } = require('../utils/id');
const paths = require('../utils/paths');

class DuplicateKeyError extends Error {
  constructor(field, value) {
    super(`Valor duplicado para campo único "${field}": ${JSON.stringify(value)}`);
    this.name = 'DuplicateKeyError';
    this.field = field;
    this.value = value;
  }
}

class NotFoundError extends Error {
  constructor(id) {
    super(`Documento não encontrado: ${id}`);
    this.name = 'NotFoundError';
  }
}

class Collection {
  constructor(database, name, schemaDefinition = {}) {
    this.database = database;
    this.name = name;
    this.schema = schemaDefinition instanceof Schema ? schemaDefinition : new Schema(schemaDefinition);
    this._storage = new Storage(paths.collectionFile(database.root, name));
    this._indexes = new Map(); // field -> Index

    this._storage._load();
    this._buildIndexesFromSchema();
  }

  _buildIndexesFromSchema() {
    for (const field of this.schema.uniqueFields) {
      const idx = new Index(field, { unique: true });
      idx.build(this._storage.readAll());
      this._indexes.set(field, idx);
    }
  }

  _rebuildIndexes() {
    for (const idx of this._indexes.values()) {
      idx.build(this._storage.readAll());
    }
  }

  /** Cria (ou substitui) um índice em um campo, único ou não. */
  createIndex(field, { unique = false } = {}) {
    const idx = new Index(field, { unique });
    idx.build(this._storage.readAll());
    this._indexes.set(field, idx);
    return this;
  }

  /** Persiste a coleção em disco. Sempre síncrono para garantir durabilidade imediata. */
  _persist() {
    this._storage.flushSync();
  }

  _withinTransaction() {
    return !!this.database._activeTransaction;
  }

  _maybeTrack() {
    if (this._withinTransaction()) {
      this.database._activeTransaction._track(this);
    }
  }

  _checkUnique(doc, ignoreId = null) {
    for (const [field, idx] of this._indexes.entries()) {
      if (!idx.unique) continue;
      const value = doc[field];
      if (value === undefined || value === null) continue;
      const existingId = idx.get(value);
      if (existingId !== undefined && existingId !== ignoreId) {
        throw new DuplicateKeyError(field, value);
      }
    }
  }

  // ────────────────────────────────────────────
  //  CREATE
  // ────────────────────────────────────────────
  insert(data) {
    let doc = this.schema.applyDefaults({ ...data });
    Validator.assert(doc, this.schema);
    this._checkUnique(doc);

    doc._id = doc._id || generateId();
    doc._createdAt = new Date().toISOString();
    doc._updatedAt = doc._createdAt;

    const docs = this._storage.readAll();
    docs.push(doc);
    this._storage.setDocuments(docs);

    for (const idx of this._indexes.values()) idx.add(doc);

    this._maybeTrack();
    if (!this._withinTransaction()) this._persist();

    return { ...doc };
  }

  insertMany(items) {
    return items.map((item) => this.insert(item));
  }

  // ────────────────────────────────────────────
  //  READ
  // ────────────────────────────────────────────
  find(filter = {}) {
    return new Query(this._storage.readAll()).where(filter).exec().map((d) => ({ ...d }));
  }

  query() {
    return new Query(this._storage.readAll());
  }

  findOne(filter = {}) {
    const result = new Query(this._storage.readAll()).where(filter).limit(1).exec();
    return result.length ? { ...result[0] } : null;
  }

  findById(id) {
    const doc = this._storage.readAll().find((d) => d._id === id);
    return doc ? { ...doc } : null;
  }

  /** Lookup O(1) via índice, se existir; senão cai para varredura O(n). */
  findByIndex(field, value) {
    const idx = this._indexes.get(field);
    if (!idx) return this.find({ [field]: value });

    if (idx.unique) {
      const id = idx.get(value);
      return id ? this.findById(id) : null;
    }
    const ids = idx.get(value);
    const all = this._storage.readAll();
    return ids.map((id) => ({ ...all.find((d) => d._id === id) }));
  }

  count(filter = {}) {
    return new Query(this._storage.readAll()).where(filter).count();
  }

  all() {
    return this._storage.readAll().map((d) => ({ ...d }));
  }

  // ────────────────────────────────────────────
  //  UPDATE
  // ────────────────────────────────────────────
  updateById(id, patch) {
    const docs = this._storage.readAll();
    const idx = docs.findIndex((d) => d._id === id);
    if (idx === -1) throw new NotFoundError(id);

    const oldDoc = docs[idx];
    const newDoc = { ...oldDoc, ...patch, _id: oldDoc._id, _createdAt: oldDoc._createdAt };
    newDoc._updatedAt = new Date().toISOString();

    Validator.assert(newDoc, this.schema);
    this._checkUnique(newDoc, oldDoc._id);

    docs[idx] = newDoc;
    this._storage.setDocuments(docs);

    for (const index of this._indexes.values()) index.update(oldDoc, newDoc);

    this._maybeTrack();
    if (!this._withinTransaction()) this._persist();

    return { ...newDoc };
  }

  update(filter, patch) {
    const docs = this._storage.readAll();
    const matched = docs.filter((d) => Query.matches(d, filter));
    return matched.map((d) => this.updateById(d._id, patch));
  }

  // ────────────────────────────────────────────
  //  DELETE
  // ────────────────────────────────────────────
  deleteById(id) {
    const docs = this._storage.readAll();
    const idx = docs.findIndex((d) => d._id === id);
    if (idx === -1) return false;

    const [removed] = docs.splice(idx, 1);
    this._storage.setDocuments(docs);

    for (const index of this._indexes.values()) index.remove(removed);

    this._maybeTrack();
    if (!this._withinTransaction()) this._persist();

    return true;
  }

  delete(filter) {
    const docs = this._storage.readAll();
    const matched = docs.filter((d) => Query.matches(d, filter));
    let deletedCount = 0;
    for (const doc of matched) {
      if (this.deleteById(doc._id)) deletedCount++;
    }
    return deletedCount;
  }

  clear() {
    this._storage.setDocuments([]);
    for (const idx of this._indexes.values()) idx.build([]);
    this._persist();
  }

  // ────────────────────────────────────────────
  //  STATS
  // ────────────────────────────────────────────
  stats() {
    return {
      name: this.name,
      count: this._storage.readAll().length,
      indexes: Array.from(this._indexes.keys()),
      schema: this.schema.toJSON(),
    };
  }
}

module.exports = { Collection, DuplicateKeyError, NotFoundError, ValidationError };
