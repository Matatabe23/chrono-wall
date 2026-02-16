<template>
	<v-container class="py-6">
		<div class="flex items-center justify-between mb-4">
			<div class="text-h5">{{ title }}</div>
			<div class="flex gap-2">
				<v-btn
					variant="text"
					@click="goBack"
				>
					<v-icon class="mr-2">mdi-arrow-left</v-icon>
					Назад
				</v-btn>
			</div>
		</div>
		<v-btn
			color="primary"
			prepend-icon="mdi-image-plus"
            class="mb-4 w-full"
			@click="showAddDialog = true"
		>
			Добавить фото
		</v-btn>

		<div
			v-if="images.length > 0"
			class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3"
		>
			<div
				v-for="img in images"
				:key="img.path"
				class="relative rounded-lg overflow-hidden border bg-grey-lighten-4"
				:style="{
					aspectRatio:
						img.width && img.height ? img.width + ' / ' + img.height : undefined
				}"
			>
				<v-img
					:src="img.url"
					class="w-full h-full"
					:aspect-ratio="img.width && img.height ? img.width / img.height : undefined"
					cover="false"
				/>
				<div class="absolute top-2 right-2 z-10">
					<v-btn
						icon
						color="error"
						size="small"
						variant="elevated"
						class="bg-white/90"
						@click="confirmDeleteImage(img)"
					>
						<v-icon>mdi-delete</v-icon>
					</v-btn>
				</div>
			</div>
		</div>
		<div
			v-else
			class="flex items-center justify-center pa-8 border-dashed border-2 rounded"
		>
			<div class="text-medium-emphasis">
				<div class="text-h6 mb-2">Нет изображений</div>
				<div>Добавьте фото в эту коллекцию</div>
			</div>
		</div>
	</v-container>
	<AddPhotoToCollectionDialog
		v-model="showAddDialog"
		:collection="{ id, name: title }"
		@photo-added="onPhotoAdded"
	/>
	<UniversalModel
		v-model:isOpen="showDeleteImageDialog"
		maxWidth="420px"
	>
		<template #top>Удаление фото</template>
		<div class="mb-3">Вы уверены, что хотите удалить это фото из коллекции?</div>
		<template #bottom>
			<v-spacer />
			<v-btn
				text
				@click="closeDeleteImage"
				>Отмена</v-btn
			>
			<v-btn
				color="error"
				:loading="isDeleting"
				@click="doDeleteImage"
				>Удалить</v-btn
			>
		</template>
	</UniversalModel>
</template>

<script setup lang="ts">
	import { onMounted, ref, onBeforeUnmount } from 'vue';
	import { useRoute, useRouter } from 'vue-router';
	import { readAppFile, listCollections, deleteAppFile, saveFileToCollection } from '~/helpers/tauri/file';
	import AddPhotoToCollectionDialog from '~/components/AddPhotoToCollectionDialog.vue';
	import UniversalModel from '~/components/UniversalModel.vue';

	const route = useRoute();
	const router = useRouter();
	const id = route.params.id as string;
	const images = ref<Array<{ path: string; url: string; width?: number; height?: number }>>([]);
	const title = ref('Коллекция');
	const showAddDialog = ref(false);
	const showDeleteImageDialog = ref(false);
	const deleteTarget = ref<{ path: string; url: string } | null>(null);
	const isDeleting = ref(false);

	function goBack() {
		router.back();
	}

	async function loadTitle() {
		try {
			const cols = await listCollections();
			const c = cols.find((c) => c.id === id);
			title.value = c ? c.name : 'Коллекция';
		} catch {
			title.value = 'Коллекция';
		}
	}

	async function loadImages() {
		// очистка старых URL перед обновлением
		for (const img of images.value) {
			URL.revokeObjectURL(img.url);
		}
		const imgs: Array<{ path: string; url: string; width?: number; height?: number }> = [];
		try {
			const metaBytes = await readAppFile(`collections/${id}/_meta.json`);
			const metaText = new TextDecoder().decode(metaBytes);
			const meta = JSON.parse(metaText) as {
				items?: Array<{
					order: number;
					file: string;
					screen: { width: number; height: number };
					crop: { x: number; y: number; width: number; height: number };
				}>;
			};
			const items = Array.isArray(meta.items) ? [...meta.items] : [];
			items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
			for (const it of items) {
				try {
					const bytes = await readAppFile(`collections/${id}/${it.file}`);
					const blob = new Blob([bytes], { type: 'image/jpeg' });
					const fullUrl = URL.createObjectURL(blob);
					const canvas = document.createElement('canvas');
					canvas.width = it.screen.width;
					canvas.height = it.screen.height;
					const imgEl = await loadImage(fullUrl);
					const ctx = canvas.getContext('2d')!;
					ctx.drawImage(
						imgEl,
						it.crop.x,
						it.crop.y,
						it.crop.width,
						it.crop.height,
						0,
						0,
						canvas.width,
						canvas.height
					);
					const blobOut: Blob = await new Promise((resolve) =>
						canvas.toBlob((b) => resolve(b as Blob), 'image/jpeg', 0.92)
					);
					const previewUrl = URL.createObjectURL(blobOut);
					imgs.push({
						path: `collections/${id}/${it.file}`,
						url: previewUrl,
						width: canvas.width,
						height: canvas.height
					});
				} catch {}
			}
		} catch {}
		images.value = imgs;
	}

	function getImageSize(url: string): Promise<{ width: number; height: number } | null> {
		return new Promise((resolve) => {
			const img = new Image();
			img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
			img.onerror = () => resolve(null);
			img.src = url;
		});
	}

	function loadImage(url: string): Promise<HTMLImageElement> {
		return new Promise((resolve, reject) => {
			const im = new Image();
			im.onload = () => resolve(im);
			im.onerror = reject;
			im.src = url;
		});
	}

	async function onPhotoAdded() {
		showAddDialog.value = false;
		await loadImages();
	}

	function confirmDeleteImage(img: { path: string; url: string }) {
		deleteTarget.value = img;
		showDeleteImageDialog.value = true;
	}

	function closeDeleteImage() {
		showDeleteImageDialog.value = false;
		deleteTarget.value = null;
	}

	async function doDeleteImage() {
		if (!deleteTarget.value) return;
		try {
			isDeleting.value = true;
			await deleteAppFile(deleteTarget.value.path);
			URL.revokeObjectURL(deleteTarget.value.url);
			let meta: any = null;
			try {
				const bytes = await readAppFile(`collections/${id}/_meta.json`);
				meta = JSON.parse(new TextDecoder().decode(bytes));
			} catch {
				meta = { items: [] };
			}
			if (!Array.isArray(meta.items)) meta.items = [];
			meta.items = meta.items.filter((it: any) => `collections/${id}/${it.file}` !== deleteTarget.value!.path);
			meta.items.forEach((it: any, idx: number) => {
				it.order = idx + 1;
			});
			const enc = new TextEncoder();
			await saveFileToCollection(id, `_meta.json`, { contents: enc.encode(JSON.stringify(meta)) });
			await loadImages();
			closeDeleteImage();
		} catch (e) {
			console.error('Failed to delete image:', e);
		} finally {
			isDeleting.value = false;
		}
	}

	onMounted(async () => {
		await loadTitle();
		await loadImages();
	});

	onBeforeUnmount(() => {
		for (const img of images.value) {
			URL.revokeObjectURL(img.url);
		}
	});
</script>

<style scoped></style>
