<template>
	<v-container class="py-6">
		<div class="flex flex-col gap-4">
			<div class="text-h6">Тест: смена обоев (Android)</div>

			<div class="flex gap-3">
				<v-img
					v-for="(src, i) in previewUrls"
					:key="i"
					:src="src"
					width="140"
					height="80"
					cover
					class="rounded"
					@click="currentIndex = i"
				/>
			</div>

			<div class="flex items-center gap-3">
				<v-btn color="primary" @click="applyWallpaper" :loading="isApplying">
					Поменять обои
				</v-btn>
				<span v-if="error" class="text-error">{{ error }}</span>
				<span v-else-if="info" class="text-success">{{ info }}</span>
			</div>
		</div>
	</v-container>
</template>

<script setup lang="ts">
	import { onMounted, ref } from 'vue'
	import { getDeviceInfo, setDeviceWallpaper } from '~/helpers/tauri'
	import { invoke } from '@tauri-apps/api/core'

	const currentIndex = ref(0)
	const isApplying = ref(false)
	const error = ref<string | null>(null)
	const info = ref<string | null>(null)

	// Три тестовых изображения (Unsplash)
	const previewUrls = [
		'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1200&auto=format&fit=crop',
		'https://images.unsplash.com/photo-1499346030926-9a72daac6c63?q=80&w=1200&auto=format&fit=crop',
		'https://images.unsplash.com/photo-1470770903676-69b98201ea1c?q=80&w=1200&auto=format&fit=crop',
	]

	// Полные пути сохранённых изображений в хранилище приложения
	const savedPaths = ref<string[]>([])

	onMounted(async () => {
		const { platform } = await getDeviceInfo()
		if (platform !== 'android') {
			info.value = 'Работает только на Android'
			return
		}
		// Скачиваем и сохраняем тестовые изображения
		savedPaths.value = await Promise.all(
			previewUrls.map(async (url, idx) => {
				const resp = await fetch(url)
				const buf = await resp.arrayBuffer()
				const bytes = new Uint8Array(buf)
				const fileName = `wallpaper_${idx + 1}.jpg`
				const path = await invoke<string>('save_file_to_app', {
					saveType: 'pictures',
					sourcePath: null,
					contents: Array.from(bytes),
					fileName,
				})
				return path
			}),
		)
		info.value = 'Готово: изображения сохранены'
	})

	async function applyWallpaper() {
		error.value = null
		info.value = null
		const { platform } = await getDeviceInfo()
		if (platform !== 'android') {
			error.value = 'Работает только на Android'
			return
		}
		const path = savedPaths.value[currentIndex.value]
		if (!path) {
			error.value = 'Нет сохранённого изображения'
			return
		}
		try {
			isApplying.value = true
			await setDeviceWallpaper(path)
			info.value = 'Обои изменены'
		} catch (e: any) {
			error.value = e?.message || String(e)
		} finally {
			isApplying.value = false
		}
	}
</script>
