/**
 * copy-env.js — Auto-configure on fresh install.
 * Runs automatically after `npm install` (via the "postinstall" script).
 * Copies .env.example -> .env if .env does not already exist, so the
 * app (including the Gmail SMTP mail-sender) works out of the box.
 */
const fs = require('fs');
const path = require('path');

const root = __dirname;
const example = path.join(root, '.env.example');
const env = path.join(root, '.env');

if (!fs.existsSync(env)) {
  if (fs.existsSync(example)) {
    fs.copyFileSync(example, env);
    console.log('[setup] Created .env from .env.example');
  } else {
    console.warn('[setup] No .env.example found; skipping .env creation');
  }
} else {
  console.log('[setup] .env already exists; leaving it unchanged');
}