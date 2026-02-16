<template>
	<v-container class="py-6">
		<div class="flex flex-col gap-6">
			<div class="flex items-center justify-between">
				<div class="text-h5">Коллекции обоев</div>
			</div>

			<v-btn
				color="primary"
				@click="showCreateDialog = true"
				prepend-icon="mdi-plus"
			>
				Создать коллекцию
			</v-btn>

			<!-- Список коллекций -->
			<div
				v-if="collections.length > 0"
				class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
			>
				<v-card
					v-for="collection in collections"
					:key="collection.id"
					class="cursor-pointer"
				>
					<v-card-item @click="goToCollection(collection)">
						<template #prepend>
							<v-avatar
								size="64"
								rounded="lg"
							>
								<v-img
									v-if="covers[collection.id]"
									:src="covers[collection.id]"
									cover
								/>
								<v-icon
									v-else
									size="36"
									>mdi-image</v-icon
								>
							</v-avatar>
						</template>
						<v-card-title>{{ collection.name }}</v-card-title>
					</v-card-item>
					<v-card-actions class="justify-end">
						<v-btn
							icon
							color="error"
							@click.stop="confirmDelete(collection)"
						>
							<v-icon>mdi-delete</v-icon>
						</v-btn>
					</v-card-actions>
				</v-card>
			</div>

			<!-- Пустое состояние -->
			<div
				v-else
				class="flex flex-col items-center justify-center border-dashed border-2 rounded pa-8"
				style="min-height: 200px"
			>
				<div class="text-center text-medium-emphasis">
					<div class="text-h6 mb-2">Нет коллекций</div>
					<div class="text-body-2">
						Создайте первую коллекцию для организации ваших обоев
					</div>
				</div>
			</div>
		</div>

		<UniversalModel
			v-model:isOpen="showCreateDialog"
			maxWidth="500px"
		>
			<template #top>Создать коллекцию</template>
			<v-text-field
				v-model="newCollectionName"
				label="Название коллекции"
				:rules="[
					(v) => !!v || 'Название обязательно',
					(v) =>
						!collections.some((c) => c.name === v) ||
						'Коллекция с таким названием уже существует'
				]"
				autofocus
				@keyup.enter="onCreateCollection"
			/>
			<template #bottom>
				<v-spacer />
				<v-btn
					text
					@click="showCreateDialog = false"
					>Отмена</v-btn
				>
				<v-btn
					color="primary"
					@click="onCreateCollection"
					:loading="isCreating"
					>Создать</v-btn
				>
			</template>
		</UniversalModel>

		<UniversalModel
			v-model:isOpen="showDeleteDialog"
			maxWidth="480px"
		>
			<template #top>Удаление коллекции</template>
			<div class="mb-3">
				Вы уверены, что хотите удалить коллекцию «{{ deleteTarget?.name }}»?
			</div>
			<v-checkbox
				v-model="deleteConfirmed"
				label="Файлы тоже удалить"
			/>
			<template #bottom>
				<v-spacer />
				<v-btn
					text
					@click="closeDeleteDialog"
					>Отмена</v-btn
				>
				<v-btn
					color="error"
					:disabled="!deleteConfirmed"
					:loading="isDeleting"
					@click="doDelete"
					>Удалить</v-btn
				>
			</template>
		</UniversalModel>
	</v-container>
</template>

<script setup lang="ts">
	import { ref, onMounted } from 'vue';
	import {
		createCollection as createCollectionApi,
		listCollections,
		listCollectionFiles,
		readAppFile,
		deleteCollection
	} from '~/helpers/tauri/file';
	import { useRouter } from 'vue-router';
	import UniversalModel from '~/components/UniversalModel.vue';

	const collections = ref<Array<{ id: string; name: string; created_at: number }>>([]);
	const showCreateDialog = ref(false);
	const newCollectionName = ref('');
	const isCreating = ref(false);
	const router = useRouter();
	const covers = ref<Record<string, string | null>>({});
	const showDeleteDialog = ref(false);
	const deleteConfirmed = ref(true);
	const deleteTarget = ref<{ id: string; name: string } | null>(null);
	const isDeleting = ref(false);

	async function loadCollections() {
		try {
			collections.value = await listCollections();
			covers.value = {};
			for (const c of collections.value) {
				try {
					const files = await listCollectionFiles(c.id);
					const first = files.find((f) => !f.startsWith('collections/' + c.id + '/_'));
					if (first) {
						const bytes = await readAppFile(first);
						const blob = new Blob([bytes], { type: 'image/jpeg' });
						const url = URL.createObjectURL(blob);
						covers.value[c.id] = url;
					} else {
						covers.value[c.id] = null;
					}
				} catch {
					covers.value[c.id] = null;
				}
			}
		} catch (e: any) {
			console.error('Failed to load collections:', e);
		}
	}

	async function onCreateCollection() {
		if (!newCollectionName.value.trim()) {
			return;
		}

		// Проверяем уникальность названия
		if (collections.value.some((c) => c.name === newCollectionName.value.trim())) {
			return;
		}

		try {
			isCreating.value = true;
			await createCollectionApi(newCollectionName.value.trim());
			newCollectionName.value = '';
			showCreateDialog.value = false;
			await loadCollections();
		} catch (e: any) {
			console.error('Failed to create collection:', e);
		} finally {
			isCreating.value = false;
		}
	}

	function goToCollection(collection: { id: string; name: string }) {
		router.push(`/collections/${collection.id}`);
	}

	function confirmDelete(collection: { id: string; name: string }) {
		deleteTarget.value = collection;
		deleteConfirmed.value = true;
		showDeleteDialog.value = true;
	}

	function closeDeleteDialog() {
		showDeleteDialog.value = false;
		deleteTarget.value = null;
	}

	async function doDelete() {
		if (!deleteTarget.value) return;
		try {
			isDeleting.value = true;
			await deleteCollection(deleteTarget.value.id);
			closeDeleteDialog();
			await loadCollections();
		} catch (e) {
			console.error(e);
		} finally {
			isDeleting.value = false;
		}
	}

	onMounted(() => {
		loadCollections();
	});
</script>
