#!/usr/bin/env node
'use strict';

const { run } = require('../lib/cli/commands');

run(process.argv.slice(2));
