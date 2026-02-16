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
	import { createCollection as createCollectionApi, listCollections, readAppFile, deleteCollection } from '~/helpers/tauri/file';
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
			collections.value = await listCollections()
			covers.value = {}
			for (const c of collections.value) {
				try {
					const metaBytes = await readAppFile(`collections/${c.id}/_meta.json`)
					const metaText = new TextDecoder().decode(metaBytes)
					const meta = JSON.parse(metaText) as { items?: Array<{ order: number; file: string; screen: { width: number; height: number }, crop: { x: number; y: number; width: number; height: number } }> }
					const items = Array.isArray(meta.items) ? [...meta.items] : []
					items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
					const first = items[0]
					if (!first) { covers.value[c.id] = null; continue }
					const imgBytes = await readAppFile(`collections/${c.id}/${first.file}`)
					const fullBlob = new Blob([imgBytes], { type: 'image/jpeg' })
					const fullUrl = URL.createObjectURL(fullBlob)
					const canvas = document.createElement('canvas')
					canvas.width = first.screen.width
					canvas.height = first.screen.height
					const imgEl = await new Promise<HTMLImageElement>((resolve, reject) => {
						const im = new Image()
						im.onload = () => resolve(im)
						im.onerror = reject
						im.src = fullUrl
					})
					const ctx = canvas.getContext('2d')!
					ctx.drawImage(
						imgEl,
						first.crop.x, first.crop.y, first.crop.width, first.crop.height,
						0, 0, canvas.width, canvas.height
					)
					const blobOut: Blob = await new Promise((resolve) =>
						canvas.toBlob((b) => resolve(b as Blob), 'image/jpeg', 0.92)
					)
					covers.value[c.id] = URL.createObjectURL(blobOut)
				} catch {
					covers.value[c.id] = null
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
