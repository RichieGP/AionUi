#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const outputPath = path.join(projectRoot, 'resources', 'build-info.json');

function run(command, fallback = '') {
  try {
    return execSync(command, {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return fallback;
  }
}

function gitDirty() {
  return run('git status --short') ? true : false;
}

const gitCommit = process.env.AIONUI_BUILD_COMMIT || run('git rev-parse --short=9 HEAD', 'unknown');
const gitCommitFull = process.env.AIONUI_BUILD_COMMIT_FULL || run('git rev-parse HEAD', 'unknown');
const gitBranch = process.env.AIONUI_BUILD_BRANCH || run('git branch --show-current', 'unknown');
const buildTime = process.env.AIONUI_BUILD_TIME || new Date().toISOString();
const buildSource = process.env.AIONUI_BUILD_SOURCE || (process.env.CI === 'true' ? 'ci' : 'local');
const dirty = process.env.AIONUI_BUILD_DIRTY ? process.env.AIONUI_BUILD_DIRTY === 'true' : gitDirty();

const buildInfo = {
  schema: 'aionui.build-info.v1',
  appName: packageJson.productName || packageJson.name || 'AionUi',
  appVersion: packageJson.version || '0.0.0',
  buildId: `${packageJson.version || '0.0.0'}+${gitCommit}${dirty ? '-dirty' : ''}`,
  buildTime,
  buildSource,
  gitCommit,
  gitCommitFull,
  gitBranch,
  gitDirty: dirty,
  machine: os.hostname(),
  platform: process.platform,
  arch: process.arch,
  aioncoreVersion: packageJson.aioncoreVersion || 'unknown',
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(buildInfo, null, 2)}\n`);
console.log(`[build-info] wrote ${path.relative(projectRoot, outputPath)} (${buildInfo.buildId})`);
