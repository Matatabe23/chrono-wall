<template>
    <v-select :items="locales" v-model="currentLocale" variant="solo" density="compact" hide-details outlined
        item-title="code" item-value="code" style="max-width: 120px">
        <template v-slot:item="{ item, props }">
            <v-list-item v-bind="props">
                <template #prepend>
                    <span :class="`flag-icon flag-icon-${item.raw.flag} mr-2`"></span>
                </template>

                <v-list-item-title>{{ (item as any).code }}</v-list-item-title>
            </v-list-item>
        </template>


    </v-select>


</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import 'flag-icon-css/css/flag-icons.min.css'

const router = useRouter()
const { locale, locales, } = useI18n()

const switchLocalePath = useSwitchLocalePath()

const currentLocale = computed({
    get: () => locale.value,
    set: (val) => {
        let path = switchLocalePath(val)
        path = path.replace(/\/\/+/g, '/')
        router.push(path)
    }
})


watch(currentLocale, (val) => {
    locale.value = val
})
</script>
