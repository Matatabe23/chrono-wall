<template>
	<div>
		<v-dialog
			v-if="!isMobile"
			v-model="isOpen"
			:max-width="maxWidth"
		>
			<v-card>
				<template v-if="$slots.top">
					<v-card-title>
						<slot name="top"></slot>
					</v-card-title>
				</template>

				<v-card-text>
					<slot></slot>
				</v-card-text>

				<template v-if="$slots.bottom">
					<v-card-actions>
						<slot name="bottom"></slot>
					</v-card-actions>
				</template>
			</v-card>
		</v-dialog>

		<v-bottom-sheet
			v-else
			v-model="isOpen"
		>
			<v-sheet
				class="flex flex-col h-full pa-4"
				:class="{ 'bottom-sheet-safe': isMobileDevice }"
			>
				<div
					class="flex flex-col h-full"
					:style="{ minHeight: minHeight }"
				>
					<template v-if="$slots.top">
						<v-card-title>
							<slot name="top"></slot>
						</v-card-title>
					</template>

					<div class="h-full flex-1 overflow-auto">
						<v-card-text>
							<slot></slot>
						</v-card-text>
					</div>

					<template v-if="$slots.bottom">
						<v-card-actions>
							<slot name="bottom"></slot>
						</v-card-actions>
					</template>
				</div>
			</v-sheet>
		</v-bottom-sheet>
	</div>
</template>

<script setup lang="ts">
	import { computed, ref, onMounted } from 'vue';
	import { useDisplay } from 'vuetify';
	import { getDeviceInfo } from '~/helpers/tauri';

	const { smAndDown } = useDisplay();

	const props = withDefaults(
		defineProps<{
			maxWidth?: string;
			minHeight?: string;
		}>(),
		{
			maxWidth: '60vw',
			minHeight: 'auto'
		}
	);

	const isOpen = defineModel<boolean>('isOpen');
	const isMobile = computed(() => smAndDown.value);

	const isMobileDevice = ref(false);
	const platform = ref<string | null>(null);

	onMounted(async () => {
		const { platform: p, isMobile: m } = await getDeviceInfo();
		platform.value = p;
		isMobileDevice.value = m;
	});
</script>

<style scoped>
/* Нижний safe area только на мобильном устройстве: как в верхнем меню, подстраивается под iOS/Android. */
.bottom-sheet-safe {
	--safe-bottom: max(env(safe-area-inset-bottom, 0px), 32px);
	padding-bottom: var(--safe-bottom) !important;
}
</style>
