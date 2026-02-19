import { open } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';
import { invoke } from '@tauri-apps/api/core';

/** Тип папки для сохранения (только для обратной совместимости pickAndSaveFile). */
export type SaveFolderType = 'pictures' | 'videos' | 'audio' | 'documents' | 'other';

const EXT_TO_FOLDER: Record<string, SaveFolderType> = {
	jpg: 'pictures',
	jpeg: 'pictures',
	png: 'pictures',
	gif: 'pictures',
	webp: 'pictures',
	heic: 'pictures',
	heif: 'pictures',
	bmp: 'pictures',
	svg: 'pictures',
	ico: 'pictures',
	mp4: 'videos',
	mkv: 'videos',
	mov: 'videos',
	avi: 'videos',
	webm: 'videos',
	m4v: 'videos',
	'3gp': 'videos',
	flv: 'videos',
	wmv: 'videos',
	mp3: 'audio',
	wav: 'audio',
	ogg: 'audio',
	m4a: 'audio',
	flac: 'audio',
	aac: 'audio',
	wma: 'audio',
	aiff: 'audio',
	pdf: 'documents',
	doc: 'documents',
	docx: 'documents',
	xls: 'documents',
	xlsx: 'documents',
	txt: 'documents',
	rtf: 'documents',
	odt: 'documents',
	ods: 'documents',
	ppt: 'documents',
	pptx: 'documents'
};

export function getSaveFolderTypeFromFileName(fileName: string): SaveFolderType {
	const ext = fileName.split('.').pop()?.toLowerCase();
	return (ext && EXT_TO_FOLDER[ext]) || 'other';
}

/**
 * Сохранить файл в папку коллекции. Возвращает относительный путь (collections/{id}/{fileName}).
 */
export async function saveFileToCollection(
	collectionId: string,
	fileName: string,
	options: { sourcePath?: string | null; contents?: Uint8Array | null }
): Promise<string> {
	const { sourcePath = null, contents = null } = options;
	const relativePath = await invoke<string>('save_file_to_collection', {
		collectionId,
		fileName,
		sourcePath,
		contents: contents ? Array.from(contents) : null
	});
	return relativePath;
}

/**
 * Прочитать файл из хранилища. path — относительный (collections/...) или полный.
 */
export async function readAppFile(path: string): Promise<Uint8Array> {
	const bytes = await invoke<number[]>('read_file_from_app', { path });
	return new Uint8Array(bytes);
}

/**
 * Удалить файл из хранилища по относительному или полному пути.
 */
export async function deleteAppFile(path: string): Promise<void> {
	await invoke('delete_app_file', { path });
}

/**
 * Установить изображение как обои устройства (Android).
 */
export async function setDeviceWallpaper(path: string, target: 'both' | 'home' | 'lock' = 'both'): Promise<void> {
	await invoke('set_device_wallpaper_target', { path, target });
}

/**
 * Открывает диалог выбора файла и сохраняет в папку приложения (обратная совместимость).
 */
export async function pickAndSaveFile(): Promise<string | null> {
	const selected = await open({ multiple: false, directory: false });
	if (selected === null || Array.isArray(selected)) return null;
	const path = selected as string;
	let fileName: string;
	if (path.startsWith('content:')) {
		fileName =
			(await invoke<string | null>('get_file_name_from_path', { path })) ??
			`file_${Date.now()}`;
	} else {
		fileName = path.split(/[/\\]/).pop() ?? `file_${Date.now()}`;
	}
	const saveType = getSaveFolderTypeFromFileName(fileName);
	const payload = {
		saveType,
		sourcePath: null as string | null,
		contents: null as number[] | null,
		fileName: null as string | null
	};
	if (path.startsWith('content:')) {
		const data = await readFile(path);
		payload.contents = Array.from(
			data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data)
		);
		payload.fileName = fileName;
	} else {
		payload.sourcePath = path;
	}
	return invoke<string>('save_file_to_app', payload);
}

/**
 * Создать новую коллекцию. Возвращает уникальный ID коллекции.
 */
export async function createCollection(name: string): Promise<string> {
	return invoke<string>('create_collection', { name });
}

/**
 * Получить список всех коллекций.
 */
export async function listCollections(): Promise<
	Array<{ id: string; name: string; created_at: number }>
> {
	return invoke<Array<{ id: string; name: string; created_at: number }>>('list_collections');
}

/**
 * Получить размер экрана устройства (Android).
 */
export async function getScreenSize(): Promise<{ width: number; height: number }> {
	const [width, height] = await invoke<[number, number]>('get_screen_size');
	return { width, height };
}

export async function listCollectionFiles(collectionId: string): Promise<string[]> {
	return invoke<string[]>('list_collection_files', { collectionId });
}

export async function deleteCollection(collectionId: string): Promise<void> {
	await invoke('delete_collection', { collectionId });
}

/** Запустить фоновый сервис смены обоев (Android). Работает 24/7 при закрытом приложении. */
export async function startWallpaperRotationService(params: {
	intervalMinutes: number;
	target: 'both' | 'lock' | 'home';
	rotationIndex: number;
	lastChangeAt: number;
	sequence: string[];
}): Promise<void> {
	await invoke('start_wallpaper_rotation_service', {
		intervalMinutes: Math.max(15, params.intervalMinutes),
		target: params.target,
		rotationIndex: params.rotationIndex,
		lastChangeAt: params.lastChangeAt,
		sequence: params.sequence
	});
}

/** Остановить фоновый сервис смены обоев (Android). */
export async function stopWallpaperRotationService(): Promise<void> {
	await invoke('stop_wallpaper_rotation_service');
}

/** Обновить состояние ротации в prefs (Android), чтобы сервис и таймер были в синхронизации. */
export async function updateRotationPrefs(params: {
	intervalMinutes: number;
	target: 'both' | 'lock' | 'home';
	rotationIndex: number;
	lastChangeAt: number;
	sequence: string[];
}): Promise<void> {
	await invoke('update_rotation_prefs', {
		intervalMinutes: params.intervalMinutes,
		target: params.target,
		rotationIndex: params.rotationIndex,
		lastChangeAt: params.lastChangeAt,
		sequence: params.sequence
	});
}

/** Получить текущее состояние ротации из prefs (Android). Для синхронизации при открытии приложения. */
export async function getWallpaperRotationState(): Promise<[number, number] | null> {
	try {
		return await invoke<[number, number]>('get_wallpaper_rotation_state');
	} catch {
		return null;
	}
}

