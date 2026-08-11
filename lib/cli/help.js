'use strict';

const logger = require('../utils/logger');

function printHelp() {
  logger.raw(`
${logger.paint('bold', logger.paint('cyan', 'gbit-db-dados'))} — banco de dados NoSQL local, 100% arquivos, zero dependências

${logger.paint('bold', 'Uso:')}
  gbit-db-dados <comando> [opções]

${logger.paint('bold', 'Comandos:')}
  init [dir]                       Cria um novo banco de dados no diretório informado (padrão: ./)
  create-collection <nome>         Cria uma coleção vazia no banco do diretório atual
  list-collections                 Lista todas as coleções do banco
  drop-collection <nome>           Remove uma coleção e todos os seus dados
  insert <coleção> <json>          Insere um documento (JSON em string) na coleção
  find <coleção> [filtroJson]      Lista documentos, com filtro opcional em JSON
  count <coleção> [filtroJson]     Conta documentos que casam com o filtro
  stats                            Mostra estatísticas do banco (coleções, contagens, índices)
  backup [rótulo]                  Cria uma cópia de segurança de todas as coleções
  version                          Mostra a versão instalada
  help                             Mostra esta mensagem

${logger.paint('bold', 'Exemplos:')}
  gbit-db-dados init ./meu-banco
  cd meu-banco
  gbit-db-dados create-collection users
  gbit-db-dados insert users '{"email":"a@a.com","name":"Ana"}'
  gbit-db-dados find users '{"name":"Ana"}'
  gbit-db-dados stats

${logger.paint('bold', 'Como biblioteca em código Node.js:')}
  const gbit = require('gbit-db-dados');
  const db = gbit.open('./meu-banco');
  const users = db.collection('users', {
    email: { type: 'string', required: true, unique: true, format: 'email' },
    password: { type: 'string', required: true, minLength: 6 },
  });
  users.insert({ email: 'a@a.com', password: 'segredo123' });
`);
}

module.exports = { printHelp };
