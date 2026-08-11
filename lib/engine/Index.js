'use strict';

/**
 * Índice de campo único (hash map valor -> id do documento OU lista de ids).
 *
 * Sem índice: buscar por email = varrer TODOS os documentos O(n).
 * Com índice: buscar por email = lookup direto no Map O(1).
 *
 * `unique: true`  -> Map<value, id>            (ex: email de usuário)
 * `unique: false` -> Map<value, Set<id>>       (ex: categoria de produto)
 */
class Index {
  constructor(field, { unique = false } = {}) {
    this.field = field;
    this.unique = unique;
    this.map = new Map();
  }

  /** Reconstrói o índice inteiro a partir da lista de documentos. */
  build(documents) {
    this.map.clear();
    for (const doc of documents) {
      this.add(doc);
    }
    return this;
  }

  add(doc) {
    const value = doc[this.field];
    if (value === undefined || value === null) return;

    if (this.unique) {
      this.map.set(value, doc._id);
    } else {
      if (!this.map.has(value)) this.map.set(value, new Set());
      this.map.get(value).add(doc._id);
    }
  }

  remove(doc) {
    const value = doc[this.field];
    if (value === undefined || value === null) return;

    if (this.unique) {
      this.map.delete(value);
    } else {
      const set = this.map.get(value);
      if (set) {
        set.delete(doc._id);
        if (set.size === 0) this.map.delete(value);
      }
    }
  }

  update(oldDoc, newDoc) {
    this.remove(oldDoc);
    this.add(newDoc);
  }

  /** Verifica se um valor já existe no índice (para checagem de unicidade). */
  has(value) {
    return this.map.has(value);
  }

  /** Retorna o(s) id(s) associados a um valor. */
  get(value) {
    if (!this.map.has(value)) return this.unique ? undefined : [];
    const entry = this.map.get(value);
    return this.unique ? entry : Array.from(entry);
  }

  toJSON() {
    const entries = [];
    for (const [key, val] of this.map.entries()) {
      entries.push([key, this.unique ? val : Array.from(val)]);
    }
    return { field: this.field, unique: this.unique, entries };
  }

  static fromJSON(json) {
    const idx = new Index(json.field, { unique: json.unique });
    for (const [key, val] of json.entries) {
      idx.map.set(key, json.unique ? val : new Set(val));
    }
    return idx;
  }
}

module.exports = Index;
