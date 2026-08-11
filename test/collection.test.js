'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const Database = require('../lib/engine/Database');

function tmpDbRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gbit-db-'));
}

test('Collection: insere e busca documentos', () => {
  const db = Database.init(tmpDbRoot());
  const users = db.collection('users');
  const doc = users.insert({ name: 'Ana', age: 30 });

  assert.ok(doc._id);
  assert.equal(doc.name, 'Ana');

  const found = users.findById(doc._id);
  assert.equal(found.age, 30);
});

test('Collection: aplica schema e valida campos obrigatórios', () => {
  const db = Database.init(tmpDbRoot());
  const users = db.collection('users', {
    email: { type: 'string', required: true, format: 'email' },
  });

  assert.throws(() => users.insert({}), /obrigatório/);
  assert.throws(() => users.insert({ email: 'invalido' }), /e-mail válido/);
  assert.doesNotThrow(() => users.insert({ email: 'ok@ok.com' }));
});

test('Collection: campo unique impede duplicados', () => {
  const db = Database.init(tmpDbRoot());
  const users = db.collection('users', {
    email: { type: 'string', required: true, unique: true },
  });

  users.insert({ email: 'dup@dup.com' });
  assert.throws(() => users.insert({ email: 'dup@dup.com' }), /Valor duplicado/);
});

test('Collection: update e delete funcionam e mantêm índices consistentes', () => {
  const db = Database.init(tmpDbRoot());
  const users = db.collection('users', {
    email: { type: 'string', unique: true },
  });

  const a = users.insert({ email: 'a@a.com', name: 'A' });
  users.updateById(a._id, { name: 'A2' });
  assert.equal(users.findById(a._id).name, 'A2');

  // depois de deletar, o email deve poder ser reusado (índice atualizado)
  users.deleteById(a._id);
  assert.equal(users.findById(a._id), null);
  assert.doesNotThrow(() => users.insert({ email: 'a@a.com', name: 'Nova' }));
});

test('Collection: persistência sobrevive a reabertura do banco', () => {
  const root = tmpDbRoot();
  const db1 = Database.init(root);
  db1.collection('users').insert({ name: 'Persistente' });

  const db2 = Database.open(root);
  const users2 = db2.collection('users');
  assert.equal(users2.count(), 1);
  assert.equal(users2.all()[0].name, 'Persistente');
});

test('Collection: findByIndex usa índice único em O(1) e retorna o doc certo', () => {
  const db = Database.init(tmpDbRoot());
  const users = db.collection('users', {
    email: { type: 'string', unique: true },
  });
  users.insert({ email: 'x@x.com', name: 'X' });
  users.insert({ email: 'y@y.com', name: 'Y' });

  const found = users.findByIndex('email', 'y@y.com');
  assert.equal(found.name, 'Y');
});
