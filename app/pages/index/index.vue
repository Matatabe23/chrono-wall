<template>
	<v-container class="py-6">
		<div class="flex flex-col gap-6">
			<div class="flex items-center justify-between">
				<div class="text-h5">Коллекции обоев</div>
				<v-btn 
					color="primary" 
					@click="showCreateDialog = true"
					prepend-icon="mdi-plus"
				>
					Создать коллекцию
				</v-btn>
			</div>

			<!-- Список коллекций -->
			<div v-if="collections.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				<v-card
					v-for="collection in collections"
					:key="collection.id"
					class="cursor-pointer"
					@click="openCollection(collection)"
				>
					<v-card-title>{{ collection.name }}</v-card-title>
					<v-card-subtitle>ID: {{ collection.id }}</v-card-subtitle>
				</v-card>
			</div>

			<!-- Пустое состояние -->
			<div v-else class="flex flex-col items-center justify-center border-dashed border-2 rounded pa-8" style="min-height: 200px">
				<div class="text-center text-medium-emphasis">
					<div class="text-h6 mb-2">Нет коллекций</div>
					<div class="text-body-2">Создайте первую коллекцию для организации ваших обоев</div>
				</div>
			</div>
		</div>

		<!-- Диалог создания коллекции -->
		<v-dialog v-model="showCreateDialog" max-width="500">
			<v-card>
				<v-card-title>Создать коллекцию</v-card-title>
				<v-card-text>
					<v-text-field
						v-model="newCollectionName"
						label="Название коллекции"
						:rules="[v => !!v || 'Название обязательно', v => !collections.some(c => c.name === v) || 'Коллекция с таким названием уже существует']"
						autofocus
						@keyup.enter="createCollection"
					/>
				</v-card-text>
				<v-card-actions>
					<v-spacer />
					<v-btn text @click="showCreateDialog = false">Отмена</v-btn>
					<v-btn color="primary" @click="createCollection" :loading="isCreating">Создать</v-btn>
				</v-card-actions>
			</v-card>
		</v-dialog>

		<!-- Диалог добавления фото в коллекцию -->
		<AddPhotoToCollectionDialog
			v-model="showAddPhotoDialog"
			:collection="selectedCollection"
			@photo-added="loadCollections"
		/>
	</v-container>
</template>

<script setup lang="ts">
	import { ref, onMounted } from 'vue'
	import { createCollection, listCollections } from '~/helpers/tauri/file'
	import AddPhotoToCollectionDialog from '~/components/AddPhotoToCollectionDialog.vue'

	const collections = ref<Array<{ id: string; name: string; created_at: number }>>([])
	const showCreateDialog = ref(false)
	const newCollectionName = ref('')
	const isCreating = ref(false)
	const showAddPhotoDialog = ref(false)
	const selectedCollection = ref<{ id: string; name: string } | null>(null)

	async function loadCollections() {
		try {
			collections.value = await listCollections()
		} catch (e: any) {
			console.error('Failed to load collections:', e)
		}
	}

	async function createCollection() {
		if (!newCollectionName.value.trim()) {
			return
		}

		// Проверяем уникальность названия
		if (collections.value.some(c => c.name === newCollectionName.value.trim())) {
			return
		}

		try {
			isCreating.value = true
			await createCollection(newCollectionName.value.trim())
			newCollectionName.value = ''
			showCreateDialog.value = false
			await loadCollections()
		} catch (e: any) {
			console.error('Failed to create collection:', e)
		} finally {
			isCreating.value = false
		}
	}

	function openCollection(collection: { id: string; name: string }) {
		selectedCollection.value = collection
		showAddPhotoDialog.value = true
	}

	onMounted(() => {
		loadCollections()
	})
</script>
