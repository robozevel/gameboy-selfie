const { URL } = require('url')

const title = 'GAMEBOY SELFIE ☻'
const BASE_URL = 'https://gameboy.guy.is/'
const description = 'Tap to snap!'
const imagePath = '/GAMEBOY_CAMERA_2019-04-30T17_29_12.png'

module.exports = () => ({
  mode: 'universal',
  render: {
    fallback: false
  },
  head: {
    title,
    meta: [
      { hid: 'og:url', property: 'og:url', content: BASE_URL },
      { hid: 'og:type', property: 'og:type', content: 'website' },
      { hid: 'og:title', property: 'og:title', content: title },
      { hid: 'og:site_name', property: 'og:site_name', content: 'guy.is' },

      // description
      { hid: 'description', name: 'description', content: description },
      { hid: 'og:description', property: 'og:description', content: description },

      // image
      { hid: 'og:image', property: 'og:image', content: new URL(imagePath, BASE_URL).toString() },
      { hid: 'og:image:type', property: 'og:image:type', content: 'image/png' },
      { hid: 'og:image:height', property: 'og:image:height', content: 720 },
      { hid: 'og:image:width', property: 'og:image:width', content: 800 }
    ],
    link: [
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: 'anonymous' },
      { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css?family=Press+Start+2P' }
    ]
  },
  loading: false,
  manifest: {
    name: title,
    ogType: null,
    ogTitle: null,
    ogDescription: null,
    ogSiteName: null,
    description: null,
    display: 'standalone',
    theme_color: '#000',
    twitterSite: '@robozevel',
    twitterCreator: '@robozevel'
  },
  modules: [
    ['@nuxtjs/pwa', { icon: false }],
    ['@nuxtjs/google-analytics', {
      id: 'UA-139919699-1'
    }]
  ],
  build: {
    extend(config, ctx) {
      // Run ESLint on save
      if (ctx.isDev && ctx.isClient) {
        config.module.rules.push({
          enforce: 'pre',
          test: /\.(js|vue)$/,
          loader: 'eslint-loader',
          exclude: /(node_modules)/
        })
      }
    }
  }
})