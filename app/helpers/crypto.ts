/**
 * Пароль нигде не хранится. Хранится только хеш (SHA-256) для проверки при входе в коллекцию.
 * Ключ расшифровки каждый раз получается из введённого пароля (PBKDF2) и сразу
 * используется для шифрования/расшифровки — в памяти только на время сессии.
 *
 * Хеш НЕ участвует в расшифровке файлов. Зашифрованный файл можно перенести на любое
 * устройство и открыть в этом приложении, введя тот же пароль — нужны только файл и пароль.
 */

/** Хеш пароля для хранения (только для проверки при вводе). SHA-256. */
export async function hashPassword(password: string): Promise<string> {
	const enc = new TextEncoder()
	const data = enc.encode(password)
	const hash = await crypto.subtle.digest('SHA-256', data)
	return Array.from(new Uint8Array(hash))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('')
}

/**
 * Verify password against stored hash.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
	const got = await hashPassword(password)
	return got === storedHash
}

const PBKDF2_ITERATIONS = 100000
const SALT_LENGTH = 16
const IV_LENGTH = 12
const KEY_LENGTH = 256

/**
 * Derive AES key from password using PBKDF2.
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
	const enc = new TextEncoder()
	const keyMaterial = await crypto.subtle.importKey(
		'raw',
		enc.encode(password),
		'PBKDF2',
		false,
		['deriveBits'],
	)
	const bits = await crypto.subtle.deriveBits(
		{
			name: 'PBKDF2',
			salt,
			iterations: PBKDF2_ITERATIONS,
			hash: 'SHA-256',
		},
		keyMaterial,
		KEY_LENGTH,
	)
	return crypto.subtle.importKey('raw', bits, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

/**
 * Encrypt data with password. Returns base64: salt (16) + iv (12) + ciphertext.
 */
export async function encryptWithPassword(password: string, data: Uint8Array): Promise<Uint8Array> {
	const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
	const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
	const key = await deriveKey(password, salt)
	const cipher = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv },
		key,
		data,
	)
	const result = new Uint8Array(salt.length + iv.length + cipher.byteLength)
	result.set(salt, 0)
	result.set(iv, salt.length)
	result.set(new Uint8Array(cipher), salt.length + iv.length)
	return result
}

/**
 * Decrypt data encrypted with encryptWithPassword.
 */
export async function decryptWithPassword(
	password: string,
	encrypted: Uint8Array,
): Promise<Uint8Array> {
	const salt = encrypted.slice(0, SALT_LENGTH)
	const iv = encrypted.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
	const cipher = encrypted.slice(SALT_LENGTH + IV_LENGTH)
	const key = await deriveKey(password, salt)
	const decrypted = await crypto.subtle.decrypt(
		{ name: 'AES-GCM', iv },
		key,
		cipher,
	)
	return new Uint8Array(decrypted)
}
