'use strict';

const FileManager = require('./FileManager');
const Serializer = require('./Serializer');

/**
 * Storage gerencia a leitura/escrita de UM arquivo de coleção.
 *
 * Estratégia de performance:
 *  - Cache em memória do documento inteiro (arquivos JSON pequenos/médios
 *    cabem tranquilamente em RAM — é o mesmo modelo usado por bancos
 *    embarcados como o lowdb).
 *  - Fila de escrita (write queue) por instância: evita que duas escritas
 *    concorrentes no mesmo processo pisem uma na outra: cada escrita
 *    aguarda a anterior terminar antes de começar.
 *  - Escrita em disco é sempre atômica (via FileManager: tmp + rename).
 */
class Storage {
  constructor(filePath) {
    this.filePath = filePath;
    this._cache = null;
    this._loaded = false;
    this._writeQueue = Promise.resolve();
  }

  /** Carrega o arquivo do disco para o cache (lazy, só na primeira vez). */
  _load() {
    if (this._loaded) return this._cache;
    if (!FileManager.exists(this.filePath)) {
      this._cache = { documents: [], meta: { count: 0 } };
      this._loaded = true;
      return this._cache;
    }
    const raw = FileManager.readRaw(this.filePath);
    const parsed = Serializer.deserialize(raw);
    this._cache = parsed || { documents: [], meta: { count: 0 } };
    this._loaded = true;
    return this._cache;
  }

  /** Retorna todos os documentos (array). Sempre uma cópia de referência viva do cache. */
  readAll() {
    return this._load().documents;
  }

  getMeta() {
    return this._load().meta;
  }

  /**
   * Persiste o estado atual em disco de forma atômica e enfileirada.
   * Retorna uma Promise resolvida quando a escrita terminar.
   */
  flush() {
    const snapshot = Serializer.serialize(this._cache);
    this._writeQueue = this._writeQueue.then(() =>
      FileManager.writeRawAsync(this.filePath, snapshot)
    );
    return this._writeQueue;
  }

  /** Versão síncrona de flush — usada pelo CLI e por operações que exigem garantia imediata. */
  flushSync() {
    const snapshot = Serializer.serialize(this._cache);
    FileManager.writeRaw(this.filePath, snapshot);
  }

  /** Substitui a lista de documentos e persiste. */
  setDocuments(documents) {
    const state = this._load();
    state.documents = documents;
    state.meta.count = documents.length;
    state.meta.updatedAt = new Date().toISOString();
  }

  destroy() {
    FileManager.remove(this.filePath);
    this._cache = { documents: [], meta: { count: 0 } };
  }
}

module.exports = Storage;
