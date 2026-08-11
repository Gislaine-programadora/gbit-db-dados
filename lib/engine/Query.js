'use strict';

/**
 * Motor de consultas estilo MongoDB, operando sobre arrays em memória.
 *
 * Suporta filtros simples:      { status: 'active' }
 * Operadores:                   { age: { $gt: 18, $lte: 65 } }
 * Composição lógica:            { $or: [{a:1},{b:2}] }, { $and: [...] }
 * Encadeamento fluente:         query.where(...).sort(...).limit(...).exec()
 */
class Query {
  constructor(documents) {
    this._documents = documents;
    this._filter = {};
    this._sortField = null;
    this._sortDir = 1;
    this._limitN = null;
    this._skipN = 0;
  }

  where(filter) {
    this._filter = filter || {};
    return this;
  }

  sort(field, direction = 'asc') {
    this._sortField = field;
    this._sortDir = direction === 'desc' ? -1 : 1;
    return this;
  }

  limit(n) {
    this._limitN = n;
    return this;
  }

  skip(n) {
    this._skipN = n;
    return this;
  }

  exec() {
    let results = this._documents.filter((doc) => Query.matches(doc, this._filter));

    if (this._sortField) {
      const field = this._sortField;
      const dir = this._sortDir;
      results = [...results].sort((a, b) => {
        const av = a[field];
        const bv = b[field];
        if (av === bv) return 0;
        return av > bv ? dir : -dir;
      });
    }

    if (this._skipN) results = results.slice(this._skipN);
    if (this._limitN !== null) results = results.slice(0, this._limitN);

    return results;
  }

  count() {
    return this._documents.filter((doc) => Query.matches(doc, this._filter)).length;
  }

  /** Testa se um documento satisfaz um filtro (usado também fora da classe). */
  static matches(doc, filter) {
    if (!filter || Object.keys(filter).length === 0) return true;

    for (const key of Object.keys(filter)) {
      if (key === '$or') {
        if (!filter.$or.some((sub) => Query.matches(doc, sub))) return false;
        continue;
      }
      if (key === '$and') {
        if (!filter.$and.every((sub) => Query.matches(doc, sub))) return false;
        continue;
      }
      if (key === '$not') {
        if (Query.matches(doc, filter.$not)) return false;
        continue;
      }

      const expected = filter[key];
      const actual = getPath(doc, key);

      if (expected !== null && typeof expected === 'object' && !Array.isArray(expected)) {
        if (!Query._matchOperators(actual, expected)) return false;
      } else {
        if (actual !== expected) return false;
      }
    }
    return true;
  }

  static _matchOperators(actual, ops) {
    for (const op of Object.keys(ops)) {
      const val = ops[op];
      switch (op) {
        case '$eq':
          if (actual !== val) return false;
          break;
        case '$ne':
          if (actual === val) return false;
          break;
        case '$gt':
          if (!(actual > val)) return false;
          break;
        case '$gte':
          if (!(actual >= val)) return false;
          break;
        case '$lt':
          if (!(actual < val)) return false;
          break;
        case '$lte':
          if (!(actual <= val)) return false;
          break;
        case '$in':
          if (!val.includes(actual)) return false;
          break;
        case '$nin':
          if (val.includes(actual)) return false;
          break;
        case '$exists':
          if (val ? actual === undefined : actual !== undefined) return false;
          break;
        case '$regex':
          if (typeof actual !== 'string' || !new RegExp(val).test(actual)) return false;
          break;
        case '$contains':
          if (!Array.isArray(actual) || !actual.includes(val)) return false;
          break;
        default:
          // operador desconhecido: ignora silenciosamente
          break;
      }
    }
    return true;
  }
}

function getPath(obj, path) {
  if (!path.includes('.')) return obj[path];
  return path.split('.').reduce((acc, part) => (acc == null ? undefined : acc[part]), obj);
}

module.exports = Query;
