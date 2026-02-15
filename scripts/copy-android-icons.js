/**
 * Копирует сгенерированные Tauri иконки из src-tauri/icons/android
 * в Android-проект gen/android/app/src/main/res
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const src = path.join(root, 'src-tauri', 'icons', 'android');
const dst = path.join(root, 'src-tauri', 'gen', 'android', 'app', 'src', 'main', 'res');

if (!fs.existsSync(src)) {
  console.warn('Icons not found. Run: npx tauri icon src-tauri/icons/icon.png');
  process.exit(0);
}

function copyRecursive(srcDir, dstDir) {
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(srcDir, e.name);
    const d = path.join(dstDir, e.name);
    if (e.isDirectory()) {
      if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
      copyRecursive(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

copyRecursive(src, dst);
console.log('Android icons copied to gen/android res.');
