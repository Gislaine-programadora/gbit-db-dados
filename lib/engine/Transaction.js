'use strict';

const fs = require('fs');
const path = require('path');
const { generateId } = require('../utils/id');

/**
 * Transaction agrupa várias operações em coleções diferentes (ou na mesma)
 * e garante tudo-ou-nada:
 *
 *   const tx = db.transaction();
 *   tx.run(() => {
 *     users.insert({...});
 *     accounts.insert({...});
 *   });
 *
 * Como funciona:
 *  1. Antes de rodar, tira um snapshot (deep copy) do estado atual de cada
 *     coleção envolvida.
 *  2. Executa a função da transação normalmente (as escritas acontecem
 *     direto na coleção, em memória).
 *  3. Se tudo correr bem -> persiste todas as coleções tocadas e grava um
 *     log da transação em /transactions.
 *  4. Se der throw em qualquer ponto -> restaura o snapshot de TODAS as
 *     coleções envolvidas (rollback) e repropaga o erro.
 */
class Transaction {
  constructor(database) {
    this.database = database;
    this.id = generateId();
    this._touched = new Set();
  }

  /** Chamado internamente pela Collection sempre que uma escrita ocorre dentro de uma tx ativa. */
  _track(collection) {
    this._touched.add(collection);
  }

  run(fn) {
    const snapshots = new Map();

    // Ativa modo transação: cada Collection tocada vai chamar this._track()
    this.database._activeTransaction = this;

    try {
      // Precisamos capturar snapshot de TODAS as coleções já carregadas,
      // pois não sabemos de antemão quais serão tocadas.
      for (const [name, collection] of this.database._collections.entries()) {
        snapshots.set(name, JSON.parse(JSON.stringify(collection._storage.readAll())));
      }

      const result = fn();

      // Sucesso: persiste apenas as coleções realmente tocadas
      for (const collection of this._touched) {
        collection._persist();
      }

      this._writeLog('committed', null);
      return result;
    } catch (err) {
      // Rollback: restaura snapshots em memória das coleções tocadas
      for (const collection of this._touched) {
        const snap = snapshots.get(collection.name);
        if (snap) {
          collection._storage.setDocuments(snap);
          collection._rebuildIndexes();
        }
      }
      this._writeLog('rolled_back', err.message);
      throw err;
    } finally {
      this.database._activeTransaction = null;
      this._touched.clear();
    }
  }

  _writeLog(status, errorMessage) {
    try {
      const dir = path.join(this.database.root, 'transactions');
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, `${this.id}.json`);
      const entry = {
        id: this.id,
        status,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      };
      fs.writeFileSync(file, JSON.stringify(entry, null, 2), 'utf8');
    } catch {
      // logging de transação nunca deve derrubar a aplicação
    }
  }
}

module.exports = Transaction;
