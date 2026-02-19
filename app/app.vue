<template>
	<NuxtLayout>
		<NuxtPage />

		<v-overlay
			:model-value="isLoading"
			absolute
			class="flex justify-center items-center"
		>
			<v-progress-circular
				indeterminate
				size="64"
				color="primary"
			/>
		</v-overlay>
	</NuxtLayout>
</template>

<script setup lang="ts">
	import { useI18n } from 'vue-i18n';
	import { useAppStore } from '~/stores/app';

	const appStore = useAppStore();
	const { locale, availableLocales } = useI18n();
	const router = useRouter();
	const route = useRoute();
	const switchLocalePath = useSwitchLocalePath();

	const isLoading = ref(true);

	onMounted(async () => {
		isLoading.value = true;

		const hasPrefix = availableLocales.some((l) => route.path.startsWith(`/${l}`));
		if (!hasPrefix) {
			const path = switchLocalePath(locale.value);
			router.replace(path);
		}

		if (typeof window !== 'undefined') {
			const savedTheme = localStorage.getItem('theme');
			if (savedTheme === 'dark') appStore.isDark = true;
			if (savedTheme === 'light') appStore.isDark = false;
			// Отложенное восстановление ротации, чтобы Activity успела отрисоваться (избегаем вылета на Android)
			setTimeout(() => {
				appStore.restoreRotationIfNeeded().catch(() => {});
			}, 500);
		}

		isLoading.value = false;
	});
</script>

<style scoped>
	.fade-enter-active,
	.fade-leave-active {
		transition: opacity 0.3s ease;
	}

	.fade-enter-from,
	.fade-leave-to {
		opacity: 0;
	}
</style>
