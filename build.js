#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const CHROME_DIR = 'build/chrome';
const FIREFOX_DIR = 'build/firefox';

function removeConsoleLogsFromFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const cleanedContent = content
    .split('\n')
    // Remove only standalone console calls on a single line.
    .filter(line => !/^\s*console\.(log|error|warn|info|debug)\s*\(.*\)\s*;?\s*$/.test(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
  fs.writeFileSync(filePath, cleanedContent);
  console.log(`Removed console logs from: ${filePath}`);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyFile(src, dest) {
  fs.copyFileSync(src, dest);
  console.log(`Copied: ${src} -> ${dest}`);
}

function copyDir(src, dest) {
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFile(srcPath, destPath);
    }
  }
}

function buildChrome() {
  console.log('Building Chrome extension...');
  ensureDir(CHROME_DIR);

  // Copy manifest
  copyFile('manifest.json', path.join(CHROME_DIR, 'manifest.json'));

  // Copy content script
  copyFile('content.js', path.join(CHROME_DIR, 'content.js'));

  // Copy other files
  copyFile('content.css', path.join(CHROME_DIR, 'content.css'));
  copyFile('popup.html', path.join(CHROME_DIR, 'popup.html'));
  copyFile('popup.css', path.join(CHROME_DIR, 'popup.css'));

  // Copy directories
  copyDir('data', path.join(CHROME_DIR, 'data'));
  copyDir('icons', path.join(CHROME_DIR, 'icons'));

  console.log('Chrome extension built successfully!');
}

function buildFirefox() {
  console.log('Building Firefox extension...');
  ensureDir(FIREFOX_DIR);

  // Copy Firefox manifest
  copyFile('manifest_firefox.json', path.join(FIREFOX_DIR, 'manifest.json'));

  // Copy unified content script
  copyFile('content.js', path.join(FIREFOX_DIR, 'content.js'));

  // Copy other files
  copyFile('content.css', path.join(FIREFOX_DIR, 'content.css'));
  copyFile('popup.html', path.join(FIREFOX_DIR, 'popup.html'));
  copyFile('popup.css', path.join(FIREFOX_DIR, 'popup.css'));

  // Copy directories
  copyDir('data', path.join(FIREFOX_DIR, 'data'));
  copyDir('icons', path.join(FIREFOX_DIR, 'icons'));

  console.log('Firefox extension built successfully!');
}

function clean() {
  console.log('Cleaning build directory...');
  if (fs.existsSync('build')) {
    fs.rmSync('build', { recursive: true });
  }
  console.log('Build directory cleaned!');
}

function main() {
  const args = process.argv.slice(2);
  const isDebug = args.includes('--debug');
  const isProduction = args.includes('--production') || (!args.includes('--debug') && !args.includes('chrome') && !args.includes('firefox'));

  if (args.includes('clean')) {
    clean();
    return;
  }

  const buildChromeBrowser = args.includes('chrome') || (args.length === 1 && (args.includes('--debug') || args.includes('--production'))) || args.length === 0;
  const buildFirefoxBrowser = args.includes('firefox') || (args.length === 1 && (args.includes('--debug') || args.includes('--production'))) || args.length === 0;

  if (buildChromeBrowser) {
    buildChrome();
    if (!isDebug) {
      removeConsoleLogsFromFile(path.join(CHROME_DIR, 'content.js'));
    }
  }

  if (buildFirefoxBrowser) {
    buildFirefox();
    if (!isDebug) {
      removeConsoleLogsFromFile(path.join(FIREFOX_DIR, 'content.js'));
    }
  }

  const modeText = isDebug ? ' (debug mode)' : ' (production mode - console logs removed)';
  console.log('\nBuild complete!' + modeText);
  console.log(`Chrome extension: ${CHROME_DIR}/`);
  console.log(`Firefox extension: ${FIREFOX_DIR}/`);

  if (!isDebug) {
    console.log('\nTo build with debug logs: node build.js --debug');
  }
}

main();
