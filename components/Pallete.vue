<template>
  <div class="pallete" :class="{ selected }">
    <div class="colors" :style="style"></div>
    <div class="name">{{ pallete.name }}</div>
  </div>
</template>

<script>
export default {
  name: 'Pallete',
  props: {
    pallete: Object,
    selected: Boolean,
  },
  computed: {
    style () {
      const { colors } = this.pallete
      const backgroundImage = colors.map(([ r, g, b]) => {
        const color = `rgb(${r},${g},${b})`
        return `linear-gradient(to right, ${color}, ${color})`
      }).join()

      return { backgroundImage }
    }
  }
}
</script>

<style scoped>
input {
  position: absolute;
  visibility: hidden;
}

.pallete {
  font-size: 10px;
  text-align: center;
  margin: 0 10px;
  flex: 1 0 12%;
}

.colors {
  height: 40px;
  width: 40px;
  background-size: 50% 50%;
  background-position: top left, bottom left, top right, bottom right;
  background-repeat: no-repeat;
  display: inline-block;
  margin-bottom: 10px;
}
</style>