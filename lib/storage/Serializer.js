'use strict';

/**
 * Serializer isola o formato de persistência (hoje: JSON legível).
 * Trocar o formato de armazenamento no futuro (ex: um binário compacto)
 * exige mudar só este arquivo — o resto do sistema não sabe o formato.
 */
class Serializer {
  static serialize(data) {
    return JSON.stringify(data, null, 2);
  }

  static deserialize(raw) {
    if (!raw || !raw.trim()) return null;
    return JSON.parse(raw);
  }
}

module.exports = Serializer;
