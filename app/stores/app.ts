import { defineStore } from 'pinia'
import { useTheme } from 'vuetify'
import { computed } from 'vue'
import type { IUserData } from '~/types/appStore'

export const useAppStore = defineStore('app', () => {
    const userDark = ref(false)


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



    return {
        isDark,
    }
})
