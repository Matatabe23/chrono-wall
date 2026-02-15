/**
 * Запускает сборку Tauri только на нужной ОС.
 * ios, macos — только на macOS (darwin).
 * windows — только на Windows (win32).
 * На остальных ОС — пропуск с сообщением (exit 0), чтобы build:all не падал.
 */
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const platform = process.argv[2]; // 'ios' | 'macos' | 'windows'
const requiredOS = platform === 'windows' ? 'win32' : 'darwin';
const requiredName = requiredOS === 'darwin' ? 'macOS' : 'Windows';

if (process.platform !== requiredOS) {
  console.log(`Skipping ${platform} build (requires ${requiredName}).`);
  process.exit(0);
}

const iconCmd = 'tauri icon src-tauri/icons/icon.png';

try {
  if (platform === 'ios') {
    execSync(iconCmd, { stdio: 'inherit', cwd: root, shell: true });
    execSync('tauri ios build', { stdio: 'inherit', cwd: root, shell: true });
  } else {
    // macos | windows — обычный tauri build для текущей ОС
    execSync(`${iconCmd} && tauri build`, { stdio: 'inherit', cwd: root, shell: true });
  }
  execSync(`node scripts/copy-to-build.js ${platform}`, { stdio: 'inherit', cwd: root });
} catch (e) {
  process.exit(e.status ?? 1);
}
