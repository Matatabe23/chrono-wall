<template>
	<v-app>
		<v-app-bar
			app
			:class="{ 'app-bar-mobile': isMobile }"
		>
			<div class="flex gap-2 ml-auto mr-4 items-center">
				<LanguageSelect />
				<ThemeToggle />
			</div>
		</v-app-bar>

		<v-main :class="{ 'v-main-mobile': isMobile }">
			<slot />
		</v-main>
	</v-app>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getDeviceInfo } from '~/helpers/tauri'

const isMobile = ref(false)
const platform = ref(null) // 'android' | 'ios' | 'windows' | 'macos' | 'linux' | null (браузер)

onMounted(async () => {
	const { platform: p, isMobile: m } = await getDeviceInfo()
	platform.value = p
	isMobile.value = m
})
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
