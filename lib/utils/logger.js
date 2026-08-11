'use strict';

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
};

function paint(color, text) {
  if (process.env.GBIT_NO_COLOR) return text;
  return `${COLORS[color] || ''}${text}${COLORS.reset}`;
}

const logger = {
  info(msg) {
    console.log(`${paint('blue', 'ℹ')} ${msg}`);
  },
  success(msg) {
    console.log(`${paint('green', '✓')} ${msg}`);
  },
  warn(msg) {
    console.log(`${paint('yellow', '⚠')} ${msg}`);
  },
  error(msg) {
    console.error(`${paint('red', '✗')} ${msg}`);
  },
  title(msg) {
    console.log(`\n${paint('bold', paint('cyan', msg))}`);
  },
  muted(msg) {
    console.log(paint('gray', msg));
  },
  raw(msg) {
    console.log(msg);
  },
  paint,
};

module.exports = logger;
