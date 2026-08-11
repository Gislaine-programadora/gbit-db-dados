'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Query = require('../lib/engine/Query');

const docs = [
  { _id: '1', name: 'Ana', age: 20, active: true },
  { _id: '2', name: 'Bruno', age: 35, active: false },
  { _id: '3', name: 'Carla', age: 28, active: true },
];

test('Query: filtro simples por igualdade', () => {
  const result = new Query(docs).where({ active: true }).exec();
  assert.equal(result.length, 2);
});

test('Query: operadores de comparação ($gt, $lte)', () => {
  const result = new Query(docs).where({ age: { $gt: 20, $lte: 30 } }).exec();
  assert.equal(result.length, 1);
  assert.equal(result[0].name, 'Carla');
});

test('Query: $or e $and', () => {
  const orResult = new Query(docs).where({ $or: [{ name: 'Ana' }, { name: 'Bruno' }] }).exec();
  assert.equal(orResult.length, 2);

  const andResult = new Query(docs).where({ $and: [{ active: true }, { age: { $gte: 25 } }] }).exec();
  assert.equal(andResult.length, 1);
  assert.equal(andResult[0].name, 'Carla');
});

test('Query: sort, limit e skip', () => {
  const result = new Query(docs).sort('age', 'desc').limit(2).exec();
  assert.equal(result[0].name, 'Bruno');
  assert.equal(result.length, 2);

  const skipped = new Query(docs).sort('age', 'asc').skip(1).exec();
  assert.equal(skipped[0].name, 'Carla');
});

test('Query: $in e $regex', () => {
  const inResult = new Query(docs).where({ name: { $in: ['Ana', 'Carla'] } }).exec();
  assert.equal(inResult.length, 2);

  const regexResult = new Query(docs).where({ name: { $regex: '^B' } }).exec();
  assert.equal(regexResult.length, 1);
  assert.equal(regexResult[0].name, 'Bruno');
});
