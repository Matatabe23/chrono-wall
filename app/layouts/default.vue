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
			<template #top>{{ $t('settings.title') }}</template>
			<div class="mb-2 font-medium">{{ $t('settings.frequencyLabel') }}</div>
			<v-slider
				v-model="sliderIndex"
				:min="0"
				:max="durations.length - 1"
				:step="1"
				:show-ticks="false"
			/>
			<div class="mt-2 text-medium-emphasis">{{ $t('settings.currentLabel', { label: currentLabel }) }}</div>
			<v-divider class="my-4" />
			<div class="mt-4 mb-2 font-medium">{{ $t('settings.orderLabel') }}</div>
			<div class="flex items-center gap-3">
				<v-btn
					icon
					size="large"
					variant="tonal"
					:color="appStore.rotationMode === 'queue' ? 'primary' : undefined"
					@click="setRotationMode('queue')"
					:title="$t('settings.orderQueue')"
				>
					<v-icon>mdi-format-list-bulleted</v-icon>
				</v-btn>
				<v-btn
					icon
					size="large"
					variant="tonal"
					:color="appStore.rotationMode === 'random' ? 'primary' : undefined"
					@click="setRotationMode('random')"
					:title="$t('settings.orderRandom')"
				>
					<v-icon>mdi-shuffle-variant</v-icon>
				</v-btn>
			</div>
			<div class="mt-2 text-medium-emphasis text-sm">
				{{ $t('settings.orderHint') }}
			</div>
			<v-divider class="my-4" />
			<div class="mt-4 mb-2 font-medium">{{ $t('settings.targetLabel') }}</div>
			<div class="flex items-center gap-2">
				<v-btn
					icon
					size="large"
					variant="tonal"
					:color="appStore.wallpaperTarget === 'both' ? 'primary' : undefined"
					@click="setWallpaperTarget('both')"
					:title="$t('settings.targetBoth')"
				>
					<v-icon>mdi-cellphone</v-icon>
				</v-btn>
				<v-btn
					icon
					size="large"
					variant="tonal"
					:color="appStore.wallpaperTarget === 'lock' ? 'primary' : undefined"
					@click="setWallpaperTarget('lock')"
					:title="$t('settings.targetLock')"
				>
					<v-icon>mdi-lock</v-icon>
				</v-btn>
				<v-btn
					icon
					size="large"
					variant="tonal"
					:color="appStore.wallpaperTarget === 'home' ? 'primary' : undefined"
					@click="setWallpaperTarget('home')"
					:title="$t('settings.targetHome')"
				>
					<v-icon>mdi-home</v-icon>
				</v-btn>
			</div>
			<v-divider class="my-4" />
			<template #bottom>
				<v-spacer />
				<v-btn text @click="settingsOpen = false">{{ $t('common.close') }}</v-btn>
			</template>
		</UniversalModel>

		<v-main :class="{ 'v-main-mobile': isMobile }">
			<slot />
		</v-main>
	</v-app>
</template>

<script setup>
	import { ref, onMounted, computed } from 'vue';
	import { useI18n } from 'vue-i18n';
	import { getDeviceInfo } from '~/helpers/tauri';
	import { useAppStore } from '~/stores/app';
	import UniversalModel from '~/components/UniversalModel.vue';

	const { t } = useI18n();
	const isMobile = ref(false);
	const platform = ref(null);

	onMounted(async () => {
		const { platform: p, isMobile: m } = await getDeviceInfo();
		platform.value = p;
		isMobile.value = m;
	});

	const settingsOpen = ref(false);
	const appStore = useAppStore();

	async function stopRotationIfActive() {
		if (appStore.isRotating) {
			await appStore.pauseRotation();
			appStore.setRotationStoppedWarning(t('warnings.rotationStoppedSettings'));
		}
	}

	async function setRotationMode(mode) {
		await stopRotationIfActive();
		appStore.rotationMode = mode;
	}

	async function setWallpaperTarget(target) {
		await stopRotationIfActive();
		appStore.wallpaperTarget = target;
	}

	const durations = [15, 30, 60, 120, 180, 300, 600, 900, 1440];
	function fmtLabel(m) {
		if (m < 60) return t('interval.minutes', { n: m });
		const h = Math.round(m / 60);
		if (h === 1) return t('interval.hour');
		if (h >= 2 && h <= 4) return t('interval.hours2_4', { n: h });
		return t('interval.hours5plus', { n: h });
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
		set: async (i) => {
			await stopRotationIfActive();
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
