/**
 * Копирует сгенерированные Tauri иконки из src-tauri/icons/android
 * в Android-проект gen/android/app/src/main/res
 * Автоматически генерирует иконки, если их нет или если исходная иконка новее
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const iconSource = path.join(root, 'src-tauri', 'icons', 'icon.png');
const src = path.join(root, 'src-tauri', 'icons', 'android');
const dst = path.join(root, 'src-tauri', 'gen', 'android', 'app', 'src', 'main', 'res');

// Проверяем, нужно ли генерировать иконки
let needGenerate = false;
if (!fs.existsSync(src)) {
  needGenerate = true;
  console.log('Android icons not found. Generating...');
} else if (fs.existsSync(iconSource)) {
  const iconSourceTime = fs.statSync(iconSource).mtime;
  // Проверяем время модификации первой найденной иконки
  const firstIcon = path.join(src, 'mipmap-hdpi', 'ic_launcher.png');
  if (fs.existsSync(firstIcon)) {
    const iconTime = fs.statSync(firstIcon).mtime;
        if (iconSourceTime > iconTime) {
      needGenerate = true;
      console.log('Source icon is newer. Regenerating Android icons...');
    }
  } else {
    needGenerate = true;
    console.log('Android icons incomplete. Regenerating...');
  }
}

if (needGenerate) {
  try {
    // Используем npx для запуска tauri команды
    execSync('npx tauri icon src-tauri/icons/icon.png', { 
      stdio: 'inherit', 
      cwd: root,
      shell: true 
    });
    console.log('Android icons generated successfully.');
  } catch (error) {
    console.error('Failed to generate icons:', error.message);
    console.error('Please run manually: npm run tauri:generate-icons');
    process.exit(1);
  }
}

if (!fs.existsSync(src)) {
  console.warn('Icons not found after generation. Please check icon.png exists.');
  process.exit(1);
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
