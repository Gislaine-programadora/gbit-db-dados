'use strict';

const fs = require('fs');
const path = require('path');

/**
 * FileManager cuida de todas as operações brutas de I/O.
 * A escrita é ATÔMICA: grava em um arquivo temporário e só então
 * renomeia (rename é atômico na maioria dos filesystems), evitando
 * que uma queda de energia/crash corrompa os dados no meio da escrita.
 */
class FileManager {
  static exists(filePath) {
    return fs.existsSync(filePath);
  }

  static readRaw(filePath) {
    return fs.readFileSync(filePath, 'utf8');
  }

  static async readRawAsync(filePath) {
    return fs.promises.readFile(filePath, 'utf8');
  }

  static writeRaw(filePath, content) {
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
    const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmpPath, content, 'utf8');
    fs.renameSync(tmpPath, filePath);
  }

  static async writeRawAsync(filePath, content) {
    const dir = path.dirname(filePath);
    await fs.promises.mkdir(dir, { recursive: true });
    const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.promises.writeFile(tmpPath, content, 'utf8');
    await fs.promises.rename(tmpPath, filePath);
  }

  static remove(filePath) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  static copyFile(src, dest) {
    const dir = path.dirname(dest);
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(src, dest);
  }

  static listFiles(dir, ext) {
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((f) => !ext || f.endsWith(ext));
  }

  static stat(filePath) {
    return fs.statSync(filePath);
  }
}

module.exports = FileManager;
