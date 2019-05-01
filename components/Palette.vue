<template>
  <div class="palette" :class="{ selected }">
    <div class="colors" :style="style"></div>
    <div class="name">{{ name }}</div>
  </div>
</template>

<script>
export default {
  name: 'Palette',
  props: {
    palette: Array,
    selected: Boolean,
  },
  computed: {
    name () {
      return this.palette[0]
    },
    style () {
      const [, colors] = this.palette
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

.palette {
  font-size: 10px;
  text-align: center;
  margin: 0 10px;
  flex: 1 0 12%;
}

.colors {
  height: 32px;
  width: 32px;
  background-size: 50% 50%;
  background-position: top right, bottom right, bottom left, top left;
  background-repeat: no-repeat;
  display: inline-block;
  margin-bottom: 10px;
}
</style>