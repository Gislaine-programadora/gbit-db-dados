'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const Storage = require('../lib/storage/Storage');
const FileManager = require('../lib/storage/FileManager');

function tmpFile() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gbit-')), 'col.json');
}

test('Storage: cria estado vazio quando arquivo não existe', () => {
  const storage = new Storage(tmpFile());
  assert.deepEqual(storage.readAll(), []);
});

test('Storage: persiste e recarrega documentos corretamente', () => {
  const file = tmpFile();
  const storage = new Storage(file);
  storage.setDocuments([{ _id: '1', name: 'Ana' }]);
  storage.flushSync();

  const storage2 = new Storage(file);
  assert.equal(storage2.readAll().length, 1);
  assert.equal(storage2.readAll()[0].name, 'Ana');
});

test('FileManager: escrita é atômica (usa tmp + rename)', () => {
  const file = tmpFile();
  FileManager.writeRaw(file, '{"a":1}');
  assert.equal(fs.existsSync(file), true);
  const content = FileManager.readRaw(file);
  assert.equal(JSON.parse(content).a, 1);

  // não deve sobrar nenhum arquivo .tmp
  const dir = path.dirname(file);
  const leftovers = fs.readdirSync(dir).filter((f) => f.endsWith('.tmp'));
  assert.equal(leftovers.length, 0);
});
