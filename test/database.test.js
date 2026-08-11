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

test('Database.init cria a estrutura de diretórios esperada', () => {
  const root = tmpDbRoot();
  const db = Database.init(root);

  assert.equal(fs.existsSync(path.join(db.root, 'database.json')), true);
  assert.equal(fs.existsSync(path.join(db.root, 'metadata.json')), true);
  assert.equal(fs.existsSync(path.join(db.root, 'collections')), true);
  assert.equal(fs.existsSync(path.join(db.root, 'indexes')), true);
  assert.equal(fs.existsSync(path.join(db.root, 'transactions')), true);
  assert.equal(fs.existsSync(path.join(db.root, 'backups')), true);
});

test('Database: listCollections reflete coleções criadas', () => {
  const db = Database.init(tmpDbRoot());
  db.collection('users');
  db.collection('products');

  const names = db.listCollections();
  assert.deepEqual(names.sort(), ['products', 'users']);
});

test('Transaction: commit persiste todas as escritas', () => {
  const db = Database.init(tmpDbRoot());
  const users = db.collection('users');
  const orders = db.collection('orders');

  db.transact(() => {
    users.insert({ name: 'A' });
    orders.insert({ item: 'X' });
  });

  assert.equal(users.count(), 1);
  assert.equal(orders.count(), 1);
});

test('Transaction: rollback desfaz TODAS as escritas se algo falhar no meio', () => {
  const db = Database.init(tmpDbRoot());
  const users = db.collection('users', { email: { type: 'string', unique: true } });

  users.insert({ email: 'existente@x.com' });

  assert.throws(() => {
    db.transact(() => {
      users.insert({ email: 'novo@x.com' }); // ok
      users.insert({ email: 'existente@x.com' }); // duplicado -> deve estourar
    });
  });

  // o insert de 'novo@x.com' deve ter sido revertido junto
  assert.equal(users.count(), 1);
  assert.equal(users.findOne({ email: 'novo@x.com' }), null);
});

test('Database: backup copia os arquivos de coleção', () => {
  const db = Database.init(tmpDbRoot());
  db.collection('users').insert({ name: 'Backup Test' });

  const dest = db.backup('teste');
  assert.equal(fs.existsSync(path.join(dest, 'users.json')), true);
  assert.equal(fs.existsSync(path.join(dest, 'metadata.json')), true);
});

test('Database: reabrir preserva schema salvo em metadata.json', () => {
  const root = tmpDbRoot();
  const db1 = Database.init(root);
  db1.collection('users', { email: { type: 'string', required: true, unique: true } });

  const db2 = Database.open(root);
  const users2 = db2.collection('users'); // sem passar schema de novo
  assert.throws(() => users2.insert({}), /obrigatório/);
});
