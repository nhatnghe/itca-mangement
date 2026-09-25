import { createApp } from 'vue'
import { createPinia } from 'pinia'

import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'

import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { aliases, mdi } from 'vuetify/iconsets/mdi'

import App from './App.vue'
import router from './router'

const vuetify = createVuetify({
  components,
  directives,

  theme: {
    defaultTheme: 'itca',
    themes: {
      itca: {
        dark: false,
        colors: {
          primary: '#8B0D24',
          secondary: '#74091D',
          background: '#FFF8F9',
        },
      },
    },
  },

  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: {
      mdi,
    },
  },
})

createApp(App)
  .use(createPinia())
  .use(router)
  .use(vuetify)
  .mount('#app')