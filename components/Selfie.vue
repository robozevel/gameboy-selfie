<template>
  <label>
    <input type="file" accept="video/*;capture=camcorder" @change="onChange" />
    <img v-if="value" :src="value" />
  </label>
</template>

<script>
function readAsDataURL (file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = err => reject(err)
    reader.readAsDataURL(file)
  })
}

export default {
  name: 'Selfie',
  props: {
    value: null
  },
  methods: {
    async onChange ({ target, dataTransfer }) {
      const [file] = target.files || dataTransfer.files
      const url = await readAsDataURL(file)
      this.$emit('input', url)
      target.value = ''
    }
  }
}
</script>

<style scoped>
input {
  position: absolute;
  visibility: hidden;
}
</style>