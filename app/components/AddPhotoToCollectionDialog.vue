<template>
	<UniversalModel v-model:isOpen="isOpen" maxWidth="90vw" :minHeight="'auto'">
		<template #top>
			{{ $t('addPhoto.title', { name: collection?.name ?? '' }) }}
		</template>

		<div v-if="step === 1" class="flex flex-col gap-4">
			<v-btn
				color="primary"
				@click="pickImage"
				:loading="isPicking || isSaving"
				:disabled="!!batchProgress"
				prepend-icon="mdi-image-multiple"
				block
			>
				{{ batchProgress ? $t('addPhoto.addingBatch', { current: batchProgress.current, total: batchProgress.total }) : $t('addPhoto.pickImages') }}
			</v-btn>

			<div v-if="error" class="text-error">{{ error }}</div>
		</div>

		<!-- Шаг 2: Обрезка изображения. Сетка обрезки = размер окна приложения (1:1 по пиксельным пропорциям). -->
		<div v-if="step === 2 && imageUrl" class="flex flex-col gap-4 overflow-hidden">
			<!-- Обёртка с соотношением сторон окна Nuxt — сетка 1:1 с окном -->
			<div
				class="cropper-screen-wrapper"
				:style="{
					aspectRatio: gridAspectRatio,
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
				<v-btn text @click="step = 1">{{ $t('common.back') }}</v-btn>
				<v-spacer />
				<v-btn color="primary" @click="cropAndSave" :loading="isSaving">
					{{ $t('common.save') }}
				</v-btn>
			</div>
		</div>

		<template #bottom>
			<v-spacer />
			<v-btn text @click="close">{{ $t('common.close') }}</v-btn>
		</template>
	</UniversalModel>
</template>

<script setup lang="ts">
	import { ref, watch, nextTick, computed, onMounted, onUnmounted } from 'vue'
	import { useI18n } from 'vue-i18n'
	import VuePictureCropper, { cropper } from 'vue-picture-cropper'
	import 'cropperjs/dist/cropper.css'
	import { getDeviceInfo } from '~/helpers/tauri'
	import { getScreenSize, saveFileToCollection, readAppFile } from '~/helpers/tauri/file'
	import UniversalModel from '~/components/UniversalModel.vue'

	const { t } = useI18n()

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
	/** Размер экрана устройства (для метаданных обоев на Android). */
	const screenSize = ref<{ width: number; height: number; xdpi?: number; ydpi?: number } | null>(null)
	/** Пиксельный размер окна Nuxt-приложения — сетка обрезки 1:1 с окном. */
	const windowSize = ref<{ width: number; height: number }>({ width: 1080, height: 1920 })
	const isPicking = ref(false)
	const isSaving = ref(false)
	/** При пакетной загрузке: { current, total } для отображения прогресса. */
	const batchProgress = ref<{ current: number; total: number } | null>(null)
	const error = ref<string | null>(null)
	const cropperRef = ref<any>(null)
	const isOpen = computed({
		get: () => props.modelValue,
		set: (v: boolean) => emit('update:modelValue', v)
	})

	function updateWindowSize() {
		if (typeof window !== 'undefined') {
			windowSize.value = { width: window.innerWidth, height: window.innerHeight }
		}
	}

	/** Соотношение сторон окна приложения — сетка обрезки повторяет размер окна (1:1 по пропорциям). */
	const gridAspectRatio = computed(() => {
		const w = windowSize.value
		if (!w?.width || !w?.height) return 1080 / 1920
		return w.width / w.height
	})

	const cropperOptions = computed(() => ({
		viewMode: 1,
		dragMode: 'none' as const,
		movable: false,
		zoomable: false,
		zoomOnWheel: false,
		zoomOnTouch: false,
		scalable: false,
		aspectRatio: gridAspectRatio.value,
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
	}))

	onMounted(() => {
		updateWindowSize()
		window.addEventListener('resize', updateWindowSize)
	})
	onUnmounted(() => {
		window.removeEventListener('resize', updateWindowSize)
	})

	watch(() => props.modelValue, async (newVal) => {
		if (newVal && props.collection) {
			step.value = 1
			imageUrl.value = ''
			imageFile.value = null
			error.value = null
			updateWindowSize()

			// Размер экрана устройства — для метаданных обоев на Android
			try {
				const { platform } = await getDeviceInfo()
				if (platform === 'android') {
					screenSize.value = await getScreenSize()
				} else {
					screenSize.value = { width: windowSize.value.width, height: windowSize.value.height }
				}
			} catch (e: any) {
				console.error('Failed to get screen size:', e)
				screenSize.value = { width: windowSize.value.width, height: windowSize.value.height }
			}
		}
	})

	function loadImageForCrop(url: string): Promise<HTMLImageElement> {
		return new Promise((resolve, reject) => {
			const img = new Image()
			img.crossOrigin = 'anonymous'
			img.onload = () => resolve(img)
			img.onerror = () => reject(new Error('Failed to load image'))
			img.src = url
		})
	}

	function onCropperReady() {
		try {
			if (!cropper) return
			// Сброс до состояния "вписать изображение целиком в контейнер"
			cropper.reset()
			const ratio = gridAspectRatio.value
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

	/** Загружает изображение по пути и возвращает WebP blob и размеры (полное изображение, без обрезки). */
	async function loadImageAsWebp(path: string): Promise<{ uint8: Uint8Array; width: number; height: number }> {
		const { readFile } = await import('@tauri-apps/plugin-fs')
		const data = await readFile(path)
		const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data)
		const ext = path.split('.').pop()?.toLowerCase() || 'jpg'
		const mimeTypes: Record<string, string> = {
			jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp'
		}
		const blob = new Blob([bytes], { type: mimeTypes[ext] || 'image/jpeg' })
		const url = URL.createObjectURL(blob)
		try {
			const img = await loadImageForCrop(url)
			const w = img.naturalWidth
			const h = img.naturalHeight
			const canvas = document.createElement('canvas')
			canvas.width = w
			canvas.height = h
			const ctx = canvas.getContext('2d')
			if (!ctx) throw new Error('Canvas 2d not available')
			ctx.drawImage(img, 0, 0, w, h, 0, 0, w, h)
			const outBlob = await new Promise<Blob>((resolve, reject) => {
				canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/webp', 0.95)
			})
			return { uint8: new Uint8Array(await outBlob.arrayBuffer()), width: w, height: h }
		} finally {
			URL.revokeObjectURL(url)
		}
	}

	/** Пакетное сохранение нескольких фото без выбора области (полное изображение). */
	async function saveBatch(paths: string[]) {
		if (!props.collection) return
		const total = paths.length
		batchProgress.value = { current: 0, total }
		isSaving.value = true
		error.value = null

		try {
			const screenW = screenSize.value?.width ?? windowSize.value.width
			const screenH = screenSize.value?.height ?? windowSize.value.height
			const ratio = gridAspectRatio.value

			let colMeta: any = null
			try {
				const bytes = await readAppFile(`collections/${props.collection.id}/_meta.json`)
				colMeta = JSON.parse(new TextDecoder().decode(bytes))
			} catch {
				colMeta = { id: props.collection.id, name: props.collection.name, created_at: Date.now(), items: [] }
			}
			if (!Array.isArray(colMeta.items)) colMeta.items = []

			let nextId = colMeta.items.reduce((m: number, it: any) => Math.max(m, Number(it.id) || 0), 0) + 1
			let nextOrder = colMeta.items.length + 1

			for (let i = 0; i < paths.length; i++) {
				const path = paths[i]
				const baseName = (path.split(/[/\\]/).pop() ?? `image_${Date.now()}_${i}.jpg`).replace(/\.(jpe?g|png|gif|bmp)$/i, '.webp')
				const fileName = /\.webp$/i.test(baseName) ? baseName : `${baseName}.webp`

				const { readFile } = await import('@tauri-apps/plugin-fs')
				const data = await readFile(path)
				const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data)
				const ext = path.split('.').pop()?.toLowerCase() || 'jpg'
				const mimeTypes: Record<string, string> = {
					jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp'
				}
				const blob = new Blob([bytes], { type: mimeTypes[ext] || 'image/jpeg' })
				const url = URL.createObjectURL(blob)
				let iw = 0, ih = 0
				let cropX = 0, cropY = 0, cropW = 0, cropH = 0
				let outArray: Uint8Array | null = null
				try {
					const img = await loadImageForCrop(url)
					iw = img.naturalWidth
					ih = img.naturalHeight
					cropW = iw
					cropH = Math.round(cropW / ratio)
					if (cropH > ih) {
						cropH = ih
						cropW = Math.round(cropH * ratio)
					}
					cropX = Math.round((iw - cropW) / 2)
					cropY = Math.round((ih - cropH) / 2)
					const canvas = document.createElement('canvas')
					canvas.width = cropW
					canvas.height = cropH
					const ctx = canvas.getContext('2d')
					if (!ctx) throw new Error('Canvas 2d not available')
					ctx.drawImage(
						img,
						cropX, cropY, cropW, cropH,
						0, 0, cropW, cropH
					)
					const outBlob = await new Promise<Blob>((resolve, reject) => {
						canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/webp', 0.95)
					})
					outArray = new Uint8Array(await outBlob.arrayBuffer())
				} finally {
					URL.revokeObjectURL(url)
				}
				if (!outArray) throw new Error('Failed to process image')
				await saveFileToCollection(props.collection.id, fileName, { contents: outArray })

				colMeta.items.push({
					id: nextId++,
					order: nextOrder++,
					file: fileName,
					screen: { width: screenW, height: screenH },
					image: { width: iw, height: ih },
					crop: { x: cropX, y: cropY, width: cropW, height: cropH },
					savedAsCrop: true,
					created_at: Date.now()
				})
				batchProgress.value = { current: i + 1, total }
			}

			const encoder = new TextEncoder()
			await saveFileToCollection(props.collection.id, `_meta.json`, { contents: encoder.encode(JSON.stringify(colMeta)) })

			emit('photo-added')
			close()
		} catch (e: any) {
			error.value = e?.message || String(e)
		} finally {
			isSaving.value = false
			batchProgress.value = null
		}
	}

	async function pickImage() {
		error.value = null

		try {
			isPicking.value = true

			const { open } = await import('@tauri-apps/plugin-dialog')
			const selected = await open({
				multiple: true,
				directory: false,
				filters: [{
					name: t('addPhoto.imagesFilter'),
					extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']
				}]
			})

			if (!selected) return

			const paths: string[] = Array.isArray(selected) ? selected : [selected]
			if (paths.length === 0) return

			// Несколько фото — загружаем пачкой без выбора области
			if (paths.length > 1) {
				await saveBatch(paths)
				return
			}

			const path = paths[0]
			selectedPath.value = path
			selectedFileName.value = path.split(/[/\\]/).pop() ?? `image_${Date.now()}.jpg`

			const { readFile } = await import('@tauri-apps/plugin-fs')
			const data = await readFile(path)
			const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data)
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
			imageFile.value = new File([blob], 'image.jpg')

			updateWindowSize()
			await nextTick()
			step.value = 2
		} catch (e: any) {
			error.value = e?.message || String(e)
		} finally {
			isPicking.value = false
		}
	}

	async function cropAndSave() {
		if (!props.collection || !imageUrl.value || !cropper) {
			return
		}

		try {
			isSaving.value = true
			error.value = null

			const data = cropper.getData()
			const imgData = cropper.getImageData()
			const crop = {
				x: Math.round(data.x),
				y: Math.round(data.y),
				width: Math.round(data.width),
				height: Math.round(data.height)
			}
			// На Android — размер экрана, иначе — размер окна приложения (сетка была по нему)
			const screenW = screenSize.value?.width ?? windowSize.value.width
			const screenH = screenSize.value?.height ?? windowSize.value.height
			const itemMeta = {
				screen: { width: screenW, height: screenH },
				image: { width: Math.round(imgData.naturalWidth), height: Math.round(imgData.naturalHeight) },
				crop: { ...crop },
				savedAsCrop: true, // файл уже обрезан по выделенной области
				created_at: Date.now()
			}

			// Рисуем выделенную область на canvas и сохраняем её как файл — обои будут ставиться именно из этой области
			const canvas = document.createElement('canvas')
			canvas.width = crop.width
			canvas.height = crop.height
			const ctx = canvas.getContext('2d')
			if (!ctx) throw new Error('Canvas 2d not available')
			const img = await loadImageForCrop(imageUrl.value)
			ctx.drawImage(
				img,
				crop.x, crop.y, crop.width, crop.height, // источник: выделенная область
				0, 0, crop.width, crop.height             // в canvas целиком
			)
			// WebP даёт меньший размер при том же визуальном качестве (без потери качества)
			const blob = await new Promise<Blob>((resolve, reject) => {
				canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/webp', 0.95)
			})
			const uint8Array = new Uint8Array(await blob.arrayBuffer())

			let baseName = (selectedFileName.value ?? `image_${Date.now()}.jpg`).replace(/\.(jpe?g|png|gif|bmp)$/i, '.webp')
			if (!/\.webp$/i.test(baseName)) baseName = baseName ? `${baseName}.webp` : `image_${Date.now()}.webp`
			await saveFileToCollection(props.collection.id, baseName, {
				contents: uint8Array
			})

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
/* Обёртка с соотношением сторон окна приложения — сетка обрезки 1:1 с окном */
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
