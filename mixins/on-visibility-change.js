export default callback => ({
  mounted () {
    document.addEventListener('visibilitychange', this.onVisibilityChange)
  },
  beforeDestroy () {
    document.removeEventListener('visibilitychange', this.onVisibilityChange)
  },
  methods: {
    onVisibilityChange () {
      if (typeof callback === 'string') this[callback](document.hidden)
      if (typeof callback === 'function') callback.call(this, document.hidden)
    }
  }
})