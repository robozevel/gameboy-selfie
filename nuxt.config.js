const title = 'GAMEBOY SELFIE ☻ TAP TO SNAP!'

module.exports = () => ({
  mode: 'universal',
  render: {
    fallback: false
  },
  head: {
    title,
    meta: [
      { charset: 'utf-8' },
      { name: 'referrer', content: 'strict-origin' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { hid: 'og:type', property: 'og:type', content: 'website' },
      { hid: 'og:title', property: 'og:title', content: title }
    ],
    link: [
      { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css?family=Press+Start+2P' }
    ]
  },
  loading: false,
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