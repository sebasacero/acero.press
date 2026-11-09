#!/usr/bin/env node
// Hook de Claude Code (PostToolUse en Edit/Write): si el archivo tocado es un
// módulo puro con su *.test.js al lado (o es el test), corre solo ese test;
// en mcp/ los tests son por carpeta (micra.test.js), así que corre los de ella.
// Si falla, sale con 2 y Claude ve el error para arreglarlo en el mismo turno.
// Lo demás (JSX, CSS, SQL) no se toca: para eso están npm test, build y e2e.
// Se activa en .claude/settings.json (ver mcp/README.md).

import { existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, relative, resolve } from 'node:path';

let raw = '';
for await (const chunk of process.stdin) raw += chunk;
const input = JSON.parse(raw || '{}');
const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const file = input.tool_input?.file_path;
if (!file || !/\.m?js$/.test(file)) process.exit(0);

const abs = resolve(root, file);
const rel = relative(root, abs);
if (rel.startsWith('..') || !/^(src|mcp|supabase\/functions)\//.test(rel)) process.exit(0);

const sibling = /\.test\.m?js$/.test(abs) ? abs : abs.replace(/\.(m?js)$/, '.test.$1');
const tests = existsSync(sibling) ? [sibling]
  : rel.startsWith('mcp/') ? readdirSync(dirname(abs)).filter((f) => /\.test\.m?js$/.test(f)).map((f) => join(dirname(abs), f))
  : [];
if (!tests.length) process.exit(0);

const r = spawnSync(process.execPath, ['--test', '--test-reporter=dot', ...tests], { cwd: root, encoding: 'utf8', timeout: 55_000 });
if (r.status === 0) process.exit(0);
process.stderr.write(`Falló ${tests.map((t) => relative(root, t)).join(', ')} después de editar ${rel}:\n${(r.stdout + r.stderr).slice(-3000)}`);
process.exit(2);
