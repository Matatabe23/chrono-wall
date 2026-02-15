<template>
    <v-btn icon @click="toggleTheme">
        <v-icon>{{ isDark ? 'mdi-weather-sunny' : 'mdi-weather-night' }}</v-icon>
    </v-btn>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTheme } from 'vuetify'
import { useAppStore } from '~/stores/app'

const theme = useTheme()
const appStore = useAppStore()

const isDark = computed(() => appStore.isDark)

const toggleTheme = () => {
    appStore.isDark = !appStore.isDark
    theme.global.name.value = appStore.isDark ? 'dark' : 'light'
    if (typeof window !== 'undefined') {
        localStorage.setItem('theme', appStore.isDark ? 'dark' : 'light')
    }
}
</script>
