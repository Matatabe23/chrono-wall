<template>
	<v-container class="py-6">
		<div class="flex flex-col gap-4">
			<div class="text-h6">Выбор обоев (Android)</div>

			<!-- Выбранное изображение -->
			<div v-if="selectedImagePath" class="flex flex-col gap-3">
				<v-img
					:src="selectedImageUrl"
					height="300"
					cover
					class="rounded"
					style="max-width: 100%"
				/>
				<div class="text-body-2 text-medium-emphasis">
					Выбрано: {{ selectedFileName }}
				</div>
			</div>

			<!-- Плейсхолдер, если ничего не выбрано -->
			<div v-else class="flex items-center justify-center border-dashed border-2 rounded pa-8" style="min-height: 200px">
				<div class="text-center text-medium-emphasis">
					<div class="text-h6 mb-2">Изображение не выбрано</div>
					<div class="text-body-2">Нажмите "Выбрать изображение" чтобы выбрать фото</div>
				</div>
			</div>

			<div class="flex flex-col gap-3">
				<v-btn 
					color="primary" 
					@click="pickImage" 
					:loading="isPicking"
					prepend-icon="mdi-image"
				>
					Выбрать изображение
				</v-btn>

				<v-btn 
					color="success" 
					@click="applyWallpaper" 
					:loading="isApplying"
					:disabled="!selectedImagePath"
					prepend-icon="mdi-wallpaper"
				>
					Установить как обои
				</v-btn>
			</div>

			<div v-if="error" class="text-error">{{ error }}</div>
			<div v-else-if="info" class="text-success">{{ info }}</div>
		</div>
	</v-container>
</template>

<script setup lang="ts">
	import { ref } from 'vue'
	import { getDeviceInfo, setDeviceWallpaper } from '~/helpers/tauri'
	import { readAppFile } from '~/helpers/tauri/file'

	const selectedImagePath = ref<string | null>(null)
	const selectedFileName = ref<string>('')
	const selectedImageUrl = ref<string>('')
	const isPicking = ref(false)
	const isApplying = ref(false)
	const error = ref<string | null>(null)
	const info = ref<string | null>(null)

	async function pickImage() {
		error.value = null
		info.value = null
		
		const { platform } = await getDeviceInfo()
		if (platform !== 'android') {
			error.value = 'Работает только на Android'
			return
		}

		try {
			isPicking.value = true
			
			// Открываем диалог выбора файла с фильтром изображений
			const { open } = await import('@tauri-apps/plugin-dialog')
			const { readFile } = await import('@tauri-apps/plugin-fs')
			const { invoke } = await import('@tauri-apps/api/core')
			const { getSaveFolderTypeFromFileName } = await import('~/helpers/tauri/file')
			
			const selected = await open({
				multiple: false,
				directory: false,
				filters: [{
					name: 'Изображения',
					extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']
				}]
			})

			if (!selected || Array.isArray(selected)) {
				return // Пользователь отменил выбор
			}

			const path = selected as string
			
			// Получаем имя файла
			let fileName: string
			if (path.startsWith('content:')) {
				fileName = (await invoke<string | null>('get_file_name_from_path', { path })) || `image_${Date.now()}.jpg`
			} else {
				fileName = path.split(/[/\\]/).pop() || `image_${Date.now()}.jpg`
			}
			selectedFileName.value = fileName

			// Сохраняем файл в хранилище приложения
			const saveType = getSaveFolderTypeFromFileName(fileName)
			let savedPath: string
			
			if (path.startsWith('content:')) {
				// Для content:// URI читаем файл и сохраняем
				const data = await readFile(path)
				const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data)
				savedPath = await invoke<string>('save_file_to_app', {
					saveType,
					sourcePath: null,
					contents: Array.from(bytes),
					fileName
				})
			} else {
				// Для обычного пути просто копируем
				savedPath = await invoke<string>('save_file_to_app', {
					saveType,
					sourcePath: path,
					contents: null,
					fileName: null
				})
			}

			selectedImagePath.value = savedPath

			// Читаем файл и создаем URL для предпросмотра
			const fileData = await readAppFile(savedPath)
			// Определяем MIME тип по расширению файла
			const ext = fileName.split('.').pop()?.toLowerCase() || 'jpg'
			const mimeTypes: Record<string, string> = {
				jpg: 'image/jpeg',
				jpeg: 'image/jpeg',
				png: 'image/png',
				gif: 'image/gif',
				webp: 'image/webp',
				bmp: 'image/bmp'
			}
			const mimeType = mimeTypes[ext] || 'image/jpeg'
			const blob = new Blob([fileData], { type: mimeType })
			selectedImageUrl.value = URL.createObjectURL(blob)

			info.value = 'Изображение выбрано'
		} catch (e: any) {
			error.value = e?.message || String(e)
		} finally {
			isPicking.value = false
		}
	}

	async function applyWallpaper() {
		error.value = null
		info.value = null
		
		const { platform } = await getDeviceInfo()
		if (platform !== 'android') {
			error.value = 'Работает только на Android'
			return
		}

		if (!selectedImagePath.value) {
			error.value = 'Сначала выберите изображение'
			return
		}

		try {
			isApplying.value = true
			await setDeviceWallpaper(selectedImagePath.value)
			info.value = 'Обои успешно установлены!'
		} catch (e: any) {
			error.value = e?.message || String(e)
		} finally {
			isApplying.value = false
		}
	}
</script>
