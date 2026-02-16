<template>
	<v-container class="py-6">
		<div class="flex items-center justify-between mb-4">
			<div class="text-h5">{{ title }}</div>
			<v-btn variant="text" @click="goBack">
				<v-icon class="mr-2">mdi-arrow-left</v-icon>
				Назад
			</v-btn>
		</div>
		<div v-if="images.length > 0" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
			<v-img
				v-for="img in images"
				:key="img.path"
				:src="img.url"
				aspect-ratio="1"
				class="rounded-lg"
				cover
			/>
		</div>
		<div v-else class="flex items-center justify-center pa-8 border-dashed border-2 rounded">
			<div class="text-medium-emphasis">
				<div class="text-h6 mb-2">Нет изображений</div>
				<div>Добавьте фото в эту коллекцию</div>
			</div>
		</div>
	</v-container>
</template>

<script setup lang="ts">
import { onMounted, ref, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { listCollectionFiles, readAppFile, listCollections } from '~/helpers/tauri/file'

const route = useRoute()
const router = useRouter()
const id = route.params.id as string
const images = ref<Array<{ path: string; url: string }>>([])
const title = ref('Коллекция')

function goBack() {
	router.back()
}

async function loadTitle() {
	try {
		const cols = await listCollections()
		const c = cols.find(c => c.id === id)
		title.value = c ? c.name : 'Коллекция'
	} catch {
		title.value = 'Коллекция'
	}
}

async function loadImages() {
	const files = await listCollectionFiles(id)
	const imgs: Array<{ path: string; url: string }> = []
	for (const path of files) {
		try {
			const bytes = await readAppFile(path)
			const blob = new Blob([bytes], { type: 'image/jpeg' })
			const url = URL.createObjectURL(blob)
			imgs.push({ path, url })
		} catch {}
	}
	images.value = imgs
}

onMounted(async () => {
	await loadTitle()
	await loadImages()
})

onBeforeUnmount(() => {
	for (const img of images.value) {
		URL.revokeObjectURL(img.url)
	}
})
</script>

<style scoped>
</style>
