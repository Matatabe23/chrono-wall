<template>
	<v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="90vw" scrollable>
		<v-card v-if="collection">
			<v-card-title>Добавить фото в коллекцию "{{ collection.name }}"</v-card-title>
			
			<v-card-text>
				<!-- Шаг 1: Выбор изображения -->
				<div v-if="step === 1" class="flex flex-col gap-4">
					<v-btn 
						color="primary" 
						@click="pickImage" 
						:loading="isPicking"
						prepend-icon="mdi-image"
						block
					>
						Выбрать изображение
					</v-btn>

					<div v-if="error" class="text-error">{{ error }}</div>
				</div>

				<!-- Шаг 2: Обрезка изображения -->
				<div v-if="step === 2 && imageUrl && screenSize" class="flex flex-col gap-4">
					<div class="text-body-1">
						Размер экрана: {{ screenSize.width }} × {{ screenSize.height }} px
					</div>
					
					<div class="cropper-container" style="max-height: 60vh; overflow: auto">
						<VuePictureCropper
							ref="cropperRef"
							:boxStyle="{
								width: '100%',
								height: 'auto',
								backgroundColor: '#f8f9fa',
							}"
							:img="imageUrl"
							:options="{
								viewMode: 1,
								dragMode: 'move',
								aspectRatio: screenSize.width / screenSize.height,
								autoCropArea: 0.8,
								restore: false,
								guides: true,
								center: true,
								highlight: false,
								cropBoxMovable: true,
								cropBoxResizable: true,
								toggleDragModeOnDblclick: false,
							}"
							@ready="onCropperReady"
						/>
					</div>

					<div class="flex gap-2">
						<v-btn text @click="step = 1">Назад</v-btn>
						<v-spacer />
						<v-btn color="primary" @click="cropAndSave" :loading="isSaving">
							Сохранить
						</v-btn>
					</div>
				</div>
			</v-card-text>

			<v-card-actions>
				<v-spacer />
				<v-btn text @click="close">Закрыть</v-btn>
			</v-card-actions>
		</v-card>
	</v-dialog>
</template>

<script setup lang="ts">
	import { ref, watch, nextTick } from 'vue'
	import VuePictureCropper, { cropper } from 'vue-picture-cropper'
	import 'cropperjs/dist/cropper.css'
	import { getDeviceInfo } from '~/helpers/tauri'
	import { getScreenSize, saveFileToCollection } from '~/helpers/tauri/file'

	const props = defineProps<{
		modelValue: boolean
		collection: { id: string; name: string } | null
	}>()

	const emit = defineEmits<{
		'update:modelValue': [value: boolean]
		'photo-added': []
	}>()

	const step = ref(1) // 1 = выбор изображения, 2 = обрезка
	const imageUrl = ref<string>('')
	const imageFile = ref<File | null>(null)
	const screenSize = ref<{ width: number; height: number } | null>(null)
	const isPicking = ref(false)
	const isSaving = ref(false)
	const error = ref<string | null>(null)
	const cropperRef = ref<any>(null)

	watch(() => props.modelValue, async (newVal) => {
		if (newVal && props.collection) {
			step.value = 1
			imageUrl.value = ''
			imageFile.value = null
			error.value = null
			
			// Получаем размер экрана
			try {
				const { platform } = await getDeviceInfo()
				if (platform === 'android') {
					screenSize.value = await getScreenSize()
				} else {
					// Для тестирования на ПК используем стандартный размер
					screenSize.value = { width: 1080, height: 1920 }
				}
			} catch (e: any) {
				console.error('Failed to get screen size:', e)
				screenSize.value = { width: 1080, height: 1920 } // Fallback
			}
		}
	})

	function onCropperReady() {
		// Cropper готов к использованию
		console.log('Cropper ready')
	}

	async function pickImage() {
		error.value = null
		
		const { platform } = await getDeviceInfo()
		if (platform !== 'android') {
			error.value = 'Работает только на Android'
			return
		}

		try {
			isPicking.value = true
			
			const { open } = await import('@tauri-apps/plugin-dialog')
			const selected = await open({
				multiple: false,
				directory: false,
				filters: [{
					name: 'Изображения',
					extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']
				}]
			})

			if (!selected || Array.isArray(selected)) {
				return
			}

			const path = selected as string
			
			// Читаем файл для предпросмотра
			const { readFile } = await import('@tauri-apps/plugin-fs')
			const data = await readFile(path)
			const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data)
			// Определяем MIME тип по расширению файла
			const ext = path.split('.').pop()?.toLowerCase() || 'jpg'
			const mimeTypes: Record<string, string> = {
				jpg: 'image/jpeg',
				jpeg: 'image/jpeg',
				png: 'image/png',
				gif: 'image/gif',
				webp: 'image/webp',
				bmp: 'image/bmp'
			}
			const mimeType = mimeTypes[ext] || 'image/jpeg'
			
			const blob = new Blob([bytes], { type: mimeType })
			imageUrl.value = URL.createObjectURL(blob)
			
			// Сохраняем путь для дальнейшего использования
			imageFile.value = new File([blob], 'image.jpg')
			
			// Ждем следующего тика для инициализации cropper
			await nextTick()
			step.value = 2
		} catch (e: any) {
			error.value = e?.message || String(e)
		} finally {
			isPicking.value = false
		}
	}

	async function cropAndSave() {
		if (!props.collection || !imageUrl.value || !screenSize.value) {
			return
		}

		try {
			isSaving.value = true
			error.value = null

			// Получаем обрезанное изображение через cropper API
			// Используем глобальный экземпляр cropper из библиотеки
			const canvas = cropper.getCroppedCanvas({
				width: screenSize.value.width,
				height: screenSize.value.height,
				imageSmoothingEnabled: true,
				imageSmoothingQuality: 'high',
			})

			// Конвертируем canvas в blob
			const blob = await new Promise<Blob>((resolve, reject) => {
				canvas.toBlob((blob) => {
					if (blob) {
						resolve(blob)
					} else {
						reject(new Error('Failed to create blob'))
					}
				}, 'image/jpeg', 0.95)
			})

			// Конвертируем blob в Uint8Array
			const arrayBuffer = await blob.arrayBuffer()
			const uint8Array = new Uint8Array(arrayBuffer)

			// Сохраняем в коллекцию
			const fileName = `wallpaper_${Date.now()}.jpg`
			await saveFileToCollection(props.collection.id, fileName, {
				contents: uint8Array
			})

			// Очищаем и закрываем
			URL.revokeObjectURL(imageUrl.value)
			imageUrl.value = ''
			imageFile.value = null
			step.value = 1
			
			emit('photo-added')
			close()
		} catch (e: any) {
			error.value = e?.message || String(e)
		} finally {
			isSaving.value = false
		}
	}

	function close() {
		if (imageUrl.value) {
			URL.revokeObjectURL(imageUrl.value)
		}
		emit('update:modelValue', false)
	}
</script>

<style scoped>
.cropper-container {
	position: relative;
}
</style>
