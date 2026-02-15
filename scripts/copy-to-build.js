/**
 * Копирует артефакты сборки Tauri в корневую папку build/<platform>/.
 * Вызов: node scripts/copy-to-build.js <android|ios|macos|windows>
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const srcTauri = path.join(root, 'src-tauri');
const buildDir = path.join(root, 'build');
const platform = process.argv[2];

if (!platform || !['android', 'ios', 'macos', 'windows'].includes(platform)) {
  console.warn('Usage: node scripts/copy-to-build.js <android|ios|macos|windows>');
  process.exit(1);
}

const outPlatform = path.join(buildDir, platform);
if (!fs.existsSync(outPlatform)) {
  fs.mkdirSync(outPlatform, { recursive: true });
}

function copyRecursive(src, dst) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const e of entries) {
      const s = path.join(src, e.name);
      const d = path.join(dst, e.name);
      if (e.isDirectory()) {
        if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
        copyRecursive(s, d);
      } else {
        fs.copyFileSync(s, d);
      }
    }
  } else {
    const destFile = path.join(dst, path.basename(src));
    if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true });
    fs.copyFileSync(src, destFile);
  }
}

function copyDirContents(srcDir, dstSubdir = '') {
  const dst = dstSubdir ? path.join(outPlatform, dstSubdir) : outPlatform;
  if (!fs.existsSync(srcDir)) return;
  if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true });
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(srcDir, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) {
      copyRecursive(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

try {
  if (platform === 'windows') {
    const bundle = path.join(srcTauri, 'target', 'release', 'bundle');
    copyDirContents(path.join(bundle, 'nsis'), 'nsis');
    const msiDir = path.join(bundle, 'msi');
    if (fs.existsSync(msiDir)) copyDirContents(msiDir, 'msi');
  } else if (platform === 'macos') {
    const bundle = path.join(srcTauri, 'target', 'release', 'bundle');
    copyDirContents(path.join(bundle, 'dmg'), 'dmg');
    copyDirContents(path.join(bundle, 'macos'), 'macos');
  } else if (platform === 'android') {
    const outputs = path.join(srcTauri, 'gen', 'android', 'app', 'build', 'outputs');
    const apkRelease = path.join(outputs, 'apk', 'universal', 'release');
    const bundleRelease = path.join(outputs, 'bundle', 'universalRelease');
    if (fs.existsSync(apkRelease)) copyDirContents(apkRelease, 'apk');
    if (fs.existsSync(bundleRelease)) copyDirContents(bundleRelease, 'bundle');
  } else if (platform === 'ios') {
    const bundle = path.join(srcTauri, 'target', 'release', 'bundle');
    const iosBundle = path.join(bundle, 'ios');
    if (fs.existsSync(iosBundle)) {
      copyDirContents(iosBundle);
    } else {
      const genIos = path.join(srcTauri, 'gen', 'ios', 'build');
      if (fs.existsSync(genIos)) copyDirContents(genIos);
    }
  }
  console.log(`Build artifacts copied to build/${platform}/`);
} catch (err) {
  console.error('Copy failed:', err.message);
  process.exit(1);
}
