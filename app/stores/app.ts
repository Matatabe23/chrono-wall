import { defineStore } from 'pinia'
import { useTheme } from 'vuetify'
import { computed } from 'vue'
import type { IUserData } from '~/types/appStore'
import { listCollectionFiles, readAppFile, setDeviceWallpaper } from '~/helpers/tauri/file'

export const useAppStore = defineStore('app', () => {
    const userDark = ref(false)
    const changeIntervalMinutes = ref(60)
    const wallpaperTarget = ref<'both' | 'lock' | 'home'>('both')
    const activeCollectionId = ref<string | null>(null)
    const isRotating = ref(false)
    const currentIndex = ref(0)
    const sequence = ref<string[]>([])
    const lastChangeAt = ref<number | null>(null)
    let timer: any = null

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
        const savedActive = localStorage.getItem('activeCollectionId')
        if (savedActive) activeCollectionId.value = savedActive
        const savedIdx = localStorage.getItem('rotationIndex')
        if (savedIdx) currentIndex.value = Math.max(0, Number(savedIdx) || 0)
        const savedLast = localStorage.getItem('rotationLastChangeAt')
        if (savedLast) lastChangeAt.value = Number(savedLast) || null
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

    function persistRotation() {
        if (typeof window === 'undefined') return
        if (activeCollectionId.value) {
            localStorage.setItem('activeCollectionId', activeCollectionId.value)
        } else {
            localStorage.removeItem('activeCollectionId')
        }
        localStorage.setItem('rotationIndex', String(currentIndex.value))
        if (lastChangeAt.value) {
            localStorage.setItem('rotationLastChangeAt', String(lastChangeAt.value))
        }
    }

    function clearTimer() {
        if (timer) {
            clearTimeout(timer)
            timer = null
        }
    }

    async function loadSequenceForCollection(id: string): Promise<string[]> {
        try {
            const bytes = await readAppFile(`collections/${id}/_meta.json`)
            const text = new TextDecoder().decode(bytes)
            const meta = JSON.parse(text)
            if (Array.isArray(meta.items) && meta.items.length > 0) {
                const sorted = [...meta.items].sort((a: any, b: any) => {
                    const ao = Number(a.order) || Number(a.id) || 0
                    const bo = Number(b.order) || Number(b.id) || 0
                    return ao - bo
                })
                return sorted
                    .map((it: any) => it?.file)
                    .filter((f: any) => typeof f === 'string' && f.length > 0)
                    .map((f: string) => `collections/${id}/${f}`)
            }
        } catch {}
        const files = await listCollectionFiles(id)
        return files
    }

    async function applyWallpaper(path: string) {
        await setDeviceWallpaper(path)
    }

    function scheduleNext() {
        clearTimer()
        if (!isRotating.value || sequence.value.length === 0) return
        const intervalMs = Math.max(1, intervalMinutes.value) * 60 * 1000
        const now = Date.now()
        const nextAt = (lastChangeAt.value ?? now) + intervalMs
        const delay = Math.max(0, nextAt - now)
        timer = setTimeout(async () => {
            try {
                if (!isRotating.value || sequence.value.length === 0) return
                currentIndex.value = (currentIndex.value + 1) % sequence.value.length
                const nextPath = sequence.value[currentIndex.value]
                await applyWallpaper(nextPath)
                lastChangeAt.value = Date.now()
                persistRotation()
            } finally {
                scheduleNext()
            }
        }, delay)
    }

    async function startCollection(id: string) {
        clearTimer()
        activeCollectionId.value = id
        isRotating.value = true
        currentIndex.value = 0
        sequence.value = await loadSequenceForCollection(id)
        if (sequence.value.length === 0) {
            isRotating.value = false
            return
        }
        await applyWallpaper(sequence.value[currentIndex.value])
        lastChangeAt.value = Date.now()
        persistRotation()
        scheduleNext()
    }

    function pauseRotation() {
        clearTimer()
        isRotating.value = false
        persistRotation()
    }

    function resumeRotation() {
        if (!activeCollectionId.value || sequence.value.length === 0) return
        isRotating.value = true
        scheduleNext()
        persistRotation()
    }

    function isActiveCollection(id: string): boolean {
        return isRotating.value && activeCollectionId.value === id
    }

    return {
        isDark,
        intervalMinutes,
        wallpaperTarget: wallpaperTargetMode,
        activeCollectionId,
        isRotating,
        startCollection,
        pauseRotation,
        resumeRotation,
        isActiveCollection,
    }
})
