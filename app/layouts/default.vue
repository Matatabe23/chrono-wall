<template>
	<v-app>
		<v-app-bar
			app
			:class="{ 'app-bar-mobile': isMobile }"
		>
			<v-btn
				icon
				@click="settingsOpen = true"
			>
				<v-icon>mdi-cog</v-icon>
			</v-btn>

			<div class="flex gap-2 ml-auto mr-4 items-center">
				<LanguageSelect />
				<ThemeToggle />
			</div>
		</v-app-bar>

		<UniversalModel v-model:isOpen="settingsOpen" maxWidth="520px">
			<template #top>Настройки</template>
			<div class="mb-2 font-medium">Частота смены фото</div>
			<v-slider
				v-model="sliderIndex"
				:min="0"
				:max="durations.length - 1"
				:step="1"
				:show-ticks="false"
			/>
			<div class="mt-2 text-medium-emphasis">Текущая: {{ currentLabel }}</div>
			<div class="mt-4 mb-2 font-medium">Куда ставить обои</div>
			<div class="flex items-center gap-2">
				<v-btn
					icon
					variant="plain"
					:class="iconClass('both')"
					@click="appStore.wallpaperTarget = 'both'"
					title="Экран и блокировка"
				>
					<v-icon>mdi-cellphone</v-icon>
				</v-btn>
				<v-btn
					icon
					variant="plain"
					:class="iconClass('lock')"
					@click="appStore.wallpaperTarget = 'lock'"
					title="Только блокировка"
				>
					<v-icon>mdi-lock</v-icon>
				</v-btn>
				<v-btn
					icon
					variant="plain"
					:class="iconClass('home')"
					@click="appStore.wallpaperTarget = 'home'"
					title="Только главный экран"
				>
					<v-icon>mdi-home</v-icon>
				</v-btn>
			</div>
			<template #bottom>
				<v-spacer />
				<v-btn text @click="settingsOpen = false">Закрыть</v-btn>
			</template>
		</UniversalModel>

		<v-main :class="{ 'v-main-mobile': isMobile }">
			<slot />
		</v-main>
	</v-app>
</template>

<script setup>
	import { ref, onMounted, computed } from 'vue';
	import { getDeviceInfo } from '~/helpers/tauri';
	import { useAppStore } from '~/stores/app';
	import UniversalModel from '~/components/UniversalModel.vue';

	const isMobile = ref(false);
	const platform = ref(null); // 'android' | 'ios' | 'windows' | 'macos' | 'linux' | null (браузер)

	onMounted(async () => {
		const { platform: p, isMobile: m } = await getDeviceInfo();
		platform.value = p;
		isMobile.value = m;
	});

	const settingsOpen = ref(false);
	const appStore = useAppStore();

	const durations = [1, 5, 10, 15, 30, 60, 120, 180, 300, 600, 900, 1440];
	function fmtLabel(m) {
		if (m < 60) return `${m} мин`;
		const h = Math.round(m / 60);
		if (h === 1) return '1 час';
		if (h >= 2 && h <= 4) return `${h} часа`;
		return `${h} часов`;
	}

	function nearestIndex(m) {
		let idx = 0;
		let diff = Infinity;
		for (let i = 0; i < durations.length; i++) {
			const d = Math.abs(durations[i] - m);
			if (d < diff) {
				diff = d;
				idx = i;
			}
		}
		return idx;
	}

	const sliderIndex = computed({
		get: () => nearestIndex(appStore.intervalMinutes),
		set: (i) => {
			const m = durations[i] ?? durations[0];
			appStore.intervalMinutes = m;
		}
	});

	const currentLabel = computed(() => fmtLabel(appStore.intervalMinutes));

	function iconClass(mode) {
		return appStore.wallpaperTarget === mode ? 'text-primary' : 'opacity-60';
	}
</script>

<style scoped>
	/* Отступ сверху = safe area (челка iPhone, статус-бар Android). env() задаёт ОС автоматически. */
	.app-bar-mobile {
		--safe-top: max(env(safe-area-inset-top, 0px), 24px); /* 24px fallback для старых Android */
		padding-top: var(--safe-top) !important;
		min-height: calc(56px + var(--safe-top)) !important;
	}

	/* Чтобы контент не уходил под шапку: у v-main такой же верхний отступ. */
	.v-main-mobile {
		padding-top: calc(56px + max(env(safe-area-inset-top, 0px), 32px)) !important;
	}
</style>
