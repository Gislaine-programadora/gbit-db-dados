'use strict';

/**
 * Define o formato esperado dos documentos de uma coleção.
 *
 * Exemplo:
 *   new Schema({
 *     name:     { type: 'string', required: true, minLength: 2 },
 *     email:    { type: 'string', required: true, unique: true, format: 'email' },
 *     password: { type: 'string', required: true, minLength: 6 },
 *     age:      { type: 'number', min: 0, max: 150 },
 *     active:   { type: 'boolean', default: true },
 *   })
 */
class Schema {
  constructor(definition = {}) {
    this.definition = definition;
  }

  get fields() {
    return Object.keys(this.definition);
  }

  get uniqueFields() {
    return this.fields.filter((f) => this.definition[f].unique);
  }

  get requiredFields() {
    return this.fields.filter((f) => this.definition[f].required);
  }

  /** Aplica valores default aos campos ausentes de um documento. */
  applyDefaults(doc) {
    const result = { ...doc };
    for (const field of this.fields) {
      const rule = this.definition[field];
      if (result[field] === undefined && rule.default !== undefined) {
        result[field] = typeof rule.default === 'function' ? rule.default() : rule.default;
      }
    }
    return result;
  }

  toJSON() {
    return this.definition;
  }

  static fromJSON(json) {
    return new Schema(json || {});
  }
}

module.exports = Schema;
