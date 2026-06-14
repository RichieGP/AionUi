#!/usr/bin/env node

/**
 * Verify that a bundled aioncore binary can open a copy of an existing data dir.
 *
 * This catches local packaging mistakes where the Electron app is rebuilt with an
 * older downloaded AionCore release while the user's SQLite database already has
 * newer sqlx migrations applied.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const LISTENING_PREFIX = 'AIONCORE_LISTENING ';

function parseArgs(argv) {
  const out = {
    binary: '',
    dataDir: process.env.AIONUI_COMPAT_DATA_DIR || path.join(os.homedir(), '.aionui'),
    appVersion: process.env.npm_package_version || '0.0.0',
    timeoutMs: Number(process.env.AIONUI_AIONCORE_COMPAT_TIMEOUT_MS || 15000),
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--binary' && next) {
      out.binary = next;
      i += 1;
    } else if (arg === '--data-dir' && next) {
      out.dataDir = next;
      i += 1;
    } else if (arg === '--app-version' && next) {
      out.appVersion = next;
      i += 1;
    } else if (arg === '--timeout-ms' && next) {
      out.timeoutMs = Number(next);
      i += 1;
    }
  }
  return out;
}

function copyIfExists(source, dest) {
  if (!fs.existsSync(source)) return false;
  fs.copyFileSync(source, dest);
  return true;
}

function prepareDataDirCopy(sourceDataDir) {
  const sourceDb = path.join(sourceDataDir, 'aionui-backend.db');
  if (!fs.existsSync(sourceDb)) return null;

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aioncore-db-compat-'));
  fs.mkdirSync(tempRoot, { recursive: true });
  copyIfExists(sourceDb, path.join(tempRoot, 'aionui-backend.db'));
  copyIfExists(`${sourceDb}-wal`, path.join(tempRoot, 'aionui-backend.db-wal'));
  copyIfExists(`${sourceDb}-shm`, path.join(tempRoot, 'aionui-backend.db-shm'));
  return tempRoot;
}

function verifyAioncoreDbCompatibility(config) {
  if (!config.binary) throw new Error('--binary is required');
  const binary = path.resolve(config.binary);
  if (!fs.existsSync(binary)) throw new Error(`aioncore binary does not exist: ${binary}`);

  const tempDataDir = prepareDataDirCopy(path.resolve(config.dataDir));
  if (!tempDataDir) {
    return {
      skipped: true,
      reason: `No aionui-backend.db found under ${config.dataDir}`,
    };
  }

  const logDir = path.join(tempDataDir, 'logs');
  fs.mkdirSync(logDir, { recursive: true });
  const args = [
    '--port',
    '0',
    '--data-dir',
    tempDataDir,
    '--parent-pid',
    String(process.pid),
    '--log-level',
    'info',
    '--app-version',
    config.appVersion,
    '--managed-resources-mode',
    'bundled',
    '--log-dir',
    logDir,
    '--work-dir',
    tempDataDir,
    '--local',
  ];

  return new Promise((resolve, reject) => {
    let settled = false;
    let output = '';
    const child = spawn(binary, args, {
      cwd: path.dirname(binary),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const cleanup = () => {
      clearTimeout(timer);
      if (!child.killed) child.kill('SIGTERM');
      fs.rmSync(tempDataDir, { recursive: true, force: true });
    };

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn(value);
    };

    const timer = setTimeout(() => {
      finish(
        reject,
        new Error(
          `aioncore compatibility check timed out after ${config.timeoutMs}ms. Output:\n${output.slice(-4000)}`
        )
      );
    }, config.timeoutMs);

    const onData = (chunk) => {
      const text = String(chunk);
      output += text;
      if (text.includes(LISTENING_PREFIX) || output.includes(LISTENING_PREFIX)) {
        finish(resolve, {
          skipped: false,
          ok: true,
          outputPreview: output.slice(-1000),
        });
      }
    };

    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', (error) => {
      finish(reject, error);
    });
    child.on('exit', (code, signal) => {
      finish(
        reject,
        new Error(
          `aioncore exited before compatibility health passed (code=${code}, signal=${signal}). Output:\n${output.slice(-4000)}`
        )
      );
    });
  });
}

async function main() {
  const config = parseArgs(process.argv.slice(2));
  const result = await verifyAioncoreDbCompatibility(config);
  if (result.skipped) {
    console.log(`[aioncore-compat] skipped: ${result.reason}`);
    return;
  }
  console.log('[aioncore-compat] ok: bundled aioncore opened copied data dir');
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[aioncore-compat] failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  parseArgs,
  prepareDataDirCopy,
  verifyAioncoreDbCompatibility,
};
