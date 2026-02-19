<template>
	<UniversalModel v-model:isOpen="isOpen" maxWidth="90vw" :minHeight="'auto'">
		<template #top>
			Добавить фото в коллекцию "{{ collection?.name }}"
		</template>

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

		<!-- Шаг 2: Обрезка изображения. Область обрезки — в той же пропорции, что и экран телефона. -->
		<div v-if="step === 2 && imageUrl && screenSize" class="flex flex-col gap-4 overflow-hidden">
			<!-- Обёртка с соотношением сторон экрана: сетка обрезки = размер экрана -->
			<div
				class="cropper-screen-wrapper"
				:style="{
					aspectRatio: screenAspectRatio,
					maxHeight: '70vh',
				}"
			>
				<div class="cropper-container">
					<VuePictureCropper
						ref="cropperRef"
						:boxStyle="{
							width: '100%',
							height: '100%',
							backgroundColor: 'transparent',
						}"
						:img="imageUrl"
						:options="cropperOptions"
						@ready="onCropperReady"
					/>
				</div>
			</div>

			<div class="flex gap-2">
				<v-btn text @click="step = 1">Назад</v-btn>
				<v-spacer />
				<v-btn color="primary" @click="cropAndSave" :loading="isSaving">
					Сохранить
				</v-btn>
			</div>
		</div>

		<template #bottom>
			<v-spacer />
			<v-btn text @click="close">Закрыть</v-btn>
		</template>
	</UniversalModel>
</template>

<script setup lang="ts">
	import { ref, watch, nextTick, computed } from 'vue'
	import VuePictureCropper, { cropper } from 'vue-picture-cropper'
	import 'cropperjs/dist/cropper.css'
	import { getDeviceInfo } from '~/helpers/tauri'
	import { getScreenSize, saveFileToCollection, readAppFile } from '~/helpers/tauri/file'
	import UniversalModel from '~/components/UniversalModel.vue'

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
	const selectedPath = ref<string | null>(null)
	const selectedFileName = ref<string | null>(null)
	const screenSize = ref<{ width: number; height: number; xdpi?: number; ydpi?: number } | null>(null)
	const isPicking = ref(false)
	const isSaving = ref(false)
	const error = ref<string | null>(null)
	const cropperRef = ref<any>(null)
	const isOpen = computed({
		get: () => props.modelValue,
		set: (v: boolean) => emit('update:modelValue', v)
	})

	/** Соотношение сторон экрана по физическим дюймам (widthInches/heightInches), чтобы сетка обрезки повторяла телефон. */
	const screenAspectRatio = computed(() => {
		const s = screenSize.value
		if (!s) return 1080 / 1920
		const { width, height, xdpi, ydpi } = s
		if (xdpi != null && ydpi != null && xdpi > 0 && ydpi > 0) {
			// Ширина и высота в дюймах: width/xdpi, height/ydpi → aspect = (width*ydpi)/(height*xdpi)
			return (width * ydpi) / (height * xdpi)
		}
		return width / height
	})

	const cropperOptions = computed(() => {
		if (!screenSize.value) return {}
		return {
			viewMode: 1,
			dragMode: 'none' as const,
			movable: false,
			zoomable: false,
			zoomOnWheel: false,
			zoomOnTouch: false,
			scalable: false,
			aspectRatio: screenAspectRatio.value,
			autoCropArea: 0.9,
			restore: false,
			guides: true,
			center: true,
			highlight: false,
			cropBoxMovable: true,
			cropBoxResizable: true,
			toggleDragModeOnDblclick: false,
			background: false,
			responsive: true,
		}
	})

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
		try {
			if (!screenSize.value) return
			// Сброс до состояния "вписать изображение целиком в контейнер"
			cropper.reset()
			const ratio = screenAspectRatio.value
			const imgData = cropper.getImageData()
			const iw = Math.round(imgData.naturalWidth)
			const ih = Math.round(imgData.naturalHeight)
			if (!iw || !ih) return
			let cw = iw
			let ch = Math.round(cw / ratio)
			if (ch > ih) {
				ch = ih
				cw = Math.round(ch * ratio)
			}
			const x = Math.round((iw - cw) / 2)
			const y = Math.round((ih - ch) / 2)
			cropper.setData({ x, y, width: cw, height: ch })
		} catch {}
	}

	async function pickImage() {
		error.value = null

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
			selectedPath.value = path
			// Имя файла по пути
			selectedFileName.value = path.split(/[/\\]/).pop() ?? `image_${Date.now()}.jpg`

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

			// Данные об области выделения в координатах исходного изображения
			const data = cropper.getData()
			const imgData = cropper.getImageData()
			const itemMeta = {
				screen: { width: screenSize.value.width, height: screenSize.value.height },
				image: { width: Math.round(imgData.naturalWidth), height: Math.round(imgData.naturalHeight) },
				crop: {
					x: Math.round(data.x),
					y: Math.round(data.y),
					width: Math.round(data.width),
					height: Math.round(data.height)
				},
				created_at: Date.now()
			}

			// Сохраняем исходный файл без изменений
			const baseName = (selectedFileName.value ?? `image_${Date.now()}.jpg`)
			if (selectedPath.value && !selectedPath.value.startsWith('content:')) {
				await saveFileToCollection(props.collection.id, baseName, {
					sourcePath: selectedPath.value
				})
			} else if (imageFile.value) {
				const arrayBuffer = await imageFile.value.arrayBuffer()
				const uint8Array = new Uint8Array(arrayBuffer)
				await saveFileToCollection(props.collection.id, baseName, {
					contents: uint8Array
				})
			}

			// Обновляем _meta.json коллекции
			let colMeta: any = null
			try {
				const bytes = await readAppFile(`collections/${props.collection.id}/_meta.json`)
				const text = new TextDecoder().decode(bytes)
				colMeta = JSON.parse(text)
			} catch {
				colMeta = { id: props.collection.id, name: props.collection.name, created_at: Date.now(), items: [] }
			}
			if (!Array.isArray(colMeta.items)) colMeta.items = []
			const nextId = colMeta.items.reduce((m: number, it: any) => Math.max(m, Number(it.id) || 0), 0) + 1
			const nextOrder = colMeta.items.length + 1
			colMeta.items.push({
				id: nextId,
				order: nextOrder,
				file: baseName,
				...itemMeta
			})
			const encoder = new TextEncoder()
			const out = encoder.encode(JSON.stringify(colMeta))
			await saveFileToCollection(props.collection.id, `_meta.json`, { contents: out })

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
/* Обёртка с соотношением сторон экрана телефона — сетка обрезки того же размера */
.cropper-screen-wrapper {
	width: 100%;
	margin: 0 auto;
	position: relative;
	min-height: 0;
}

.cropper-container {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	overflow: hidden;
}
</style>
