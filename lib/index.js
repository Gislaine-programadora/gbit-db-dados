'use strict';

const Database = require('./engine/Database');
const Schema = require('./schema/Schema');
const { Validator, ValidationError } = require('./schema/Validator');
const { DuplicateKeyError, NotFoundError } = require('./engine/Collection');
const Query = require('./engine/Query');
const { generateId, generateUUID } = require('./utils/id');

/**
 * Ponto de entrada público da biblioteca.
 *
 *   const gbit = require('gbit-db-dados');
 *   const db = gbit.open('./meu-banco');
 *   const users = db.collection('users', { email: { type:'string', unique:true, required:true } });
 *   users.insert({ email: 'a@a.com', password: '123456' });
 */
module.exports = {
  Database,
  Schema,
  Query,
  Validator,
  ValidationError,
  DuplicateKeyError,
  NotFoundError,
  generateId,
  generateUUID,

  /** Atalho: gbit.open(path) === Database.open(path) */
  open(root) {
    return Database.open(root);
  },

  /** Atalho: gbit.init(path) === Database.init(path) */
  init(root, opts) {
    return Database.init(root, opts);
  },
};
