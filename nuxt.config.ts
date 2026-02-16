export default defineNuxtConfig({
    ssr: false,
    compatibilityDate: '2025-07-15',
    devtools: { enabled: true },
    app: {
        head: {
            meta: [
                { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' }
            ]
        }
    },
    nitro: {
        preset: "static",
    },
    css: [
        '~/assets/css/tailwind.css',
        'vuetify/lib/styles/main.sass',
        '@mdi/font/css/materialdesignicons.min.css'
    ],
    modules: ['@nuxtjs/tailwindcss', 'vuetify-nuxt-module', '@pinia/nuxt', '@nuxtjs/i18n', 'nuxt-lodash',],
    vuetify: {
        vuetifyOptions: {
            theme: {
                defaultTheme: 'dark',
            },
        },
    },

    i18n: {
        defaultLocale: 'en',
        locales: [
            { code: 'ru', name: 'Русский', file: 'ru.js', flag: 'ru' },
            { code: 'en', name: 'English', file: 'en.js', flag: 'gb' }
        ],
        langDir: '../app/locales',
        strategy: 'prefix',
    }

})
