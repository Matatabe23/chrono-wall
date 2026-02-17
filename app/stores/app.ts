import { defineStore } from 'pinia'
import { useTheme } from 'vuetify'
import { computed } from 'vue'
import type { IUserData } from '~/types/appStore'

export const useAppStore = defineStore('app', () => {
    const userDark = ref(false)
    const changeIntervalMinutes = ref(60)
    const wallpaperTarget = ref<'both' | 'lock' | 'home'>('both')

    const theme = useTheme()

    const isDark = computed({
        get: () => theme.global.name.value === 'dark' || userDark.value,
        set: (val: boolean) => {
            userDark.value = val
            theme.global.name.value = val ? 'dark' : 'light'
            if (typeof window !== 'undefined') {
                localStorage.setItem('theme', val ? 'dark' : 'light')
            }
        }
    })

    if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('changeIntervalMinutes')
        if (saved) {
            const n = Number(saved)
            if (!Number.isNaN(n) && n > 0) changeIntervalMinutes.value = n
        }
        const savedTarget = localStorage.getItem('wallpaperTarget')
        if (savedTarget === 'both' || savedTarget === 'lock' || savedTarget === 'home') {
            wallpaperTarget.value = savedTarget
        }
    }

    const intervalMinutes = computed({
        get: () => changeIntervalMinutes.value,
        set: (val: number) => {
            changeIntervalMinutes.value = val
            if (typeof window !== 'undefined') {
                localStorage.setItem('changeIntervalMinutes', String(val))
            }
        }
    })

    const wallpaperTargetMode = computed({
        get: () => wallpaperTarget.value,
        set: (val: 'both' | 'lock' | 'home') => {
            wallpaperTarget.value = val
            if (typeof window !== 'undefined') {
                localStorage.setItem('wallpaperTarget', val)
            }
        }
    })

    return {
        isDark,
        intervalMinutes,
        wallpaperTarget: wallpaperTargetMode,
    }
})
