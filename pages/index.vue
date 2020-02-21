<template>
  <main>
    <gameboy ref="gameboy" class="gameboy" @ready="onReady" :selfie="isSelfie" :zoom="zoom" :scale="scale" :max-scale="maxScale" :fit="fitScale" :options="{ brightness, threshold, palette, highContrast }">
      <img v-if="captured" :src="captured" class="overlay" />
      <div v-else class="overlay" role="button" @click="capture" :class="{ 'show-instructions': showInstructions }">
        <span class="count" v-if="showCount">{{ count }}</span>
      </div>
    </gameboy>

    <div class="buttons-container" v-if="!showCount">
      <template v-if="captured">
        <span class="button retake" role="button" @click="retake">retake</span>
        <a class="button save" role="button" :href="captured" :download="filename">save</a>
      </template>
      <template v-else>
        <div class="slider">
          <span>zoom</span>
          <input type="range" min="1" step="0.1" max="5" v-model.number="zoom" />
          <span role="button" class="button" :class="{ off: !fitScale }" @click="fitScale = !fitScale">fit</span>
          <span role="button" class="button" @click="scaleUp">{{ scale }}x</span>
        </div>
        <div class="slider">
          <span>contrast</span>
          <input type="range" v-model.number="threshold" min="0" step="5" max="255" />
          <span role="button" class="button" :class="{ off: !highContrast }" @click="highContrast = !highContrast">hi</span>
        </div>
        <div class="slider">
          <span>brightness</span>
          <input type="range" v-model.number="brightness" min="1" step="0.1" max="10" />
          <span v-if="showCameraFlip" role="button" class="button" :class="{ off: !isSelfie }" @click="isSelfie = !isSelfie">selfie</span>
          <span v-if="showFullscreen" role="button" class="button" @click="toggleFullscreen">fullscreen</span>
        </div>
        <div class="palettes">
          <palette role="button" @click.native="paletteIndex = i" v-for="(palette, i) in palettes" :palette="palette" :selected="paletteIndex === i" :key="i" />
        </div>
      </template>
    </div>

  </main>
</template>

<script>
import Palette from '~/components/Palette'
import Gameboy from '~/components/Gameboy'

import PALETTES from '~/palettes'

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

export default {
  components: {
    Gameboy,
    Palette
  },
  data () {
    return {
      isSelfie: true,
      showCameraFlip: false,
      showFullscreen: false,
      palettes: PALETTES,
      paletteIndex: 0,
      brightness: 1,
      zoom: 1,
      timestamp: null,
      fitScale: true,
      highContrast: false,
      scale: 1,
      maxScale: 2,
      threshold: 135,
      showCount: false,
      count: null,
      captured: null
    }
  },
  computed: {
    filename () {
      return `GAMEBOY_CAMERA_${this.timestamp}.png`
    },
    palette () {
      return this.palettes[this.paletteIndex]
    },
    showInstructions () {
      return !(this.captured || this.count)
    }
  },
  methods: {
    onReady ({ devices }) {
      this.showCameraFlip = devices && devices.length > 1
      this.showFullscreen = typeof document.documentElement.requestFullscreen === 'function'
    },
    toggleFullscreen () {
      const { gameboy } = this.$refs
      if (gameboy) gameboy.toggleFullscreen()
    },
    scaleUp () {
      const scale = this.scale + 1
      this.scale = scale > this.maxScale ? 1 : scale
    },
    async countdownSeconds (n) {
      let count = Number(n)
      this.count = count
      this.showCount = count > 0
      if (!this.showCount) return
      await delay(1000)
      return this.countdownSeconds(count - 1)
    },
    async capture () {
      if (this.captured || this.showCount) return
      await this.countdownSeconds(3)
      // if (this.video) this.video.pause()
      this.captured = this.$refs.gameboy.capture()
      this.timestamp = (new Date()).toISOString()
    },
    retake () {
      this.captured = null
      this.timestamp = null
    }
  }
}
</script>

<style scoped>
.gameboy {
  position: relative;
  text-align: center;
  margin: 0 auto;
}

.palettes {
  display: flex;
  flex-wrap: nowrap;
  overflow: auto;
}

h1 {
  color: #fff;
  position: relative;
  text-align: center;
  margin: 0 auto;
}

.overlay {
  color: #fff;
  font-weight: bold;
  height: 100%;
  width: 100%;
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.overlay.show-instructions:hover::after {
  pointer-events: none;
  content: 'tap to snap!';
  text-shadow: 1px 1px 0 #000;
  white-space: nowrap;
  text-transform: uppercase;
}

.overlay img {
  width: 100%;
  height: auto;
  image-rendering: pixelated;
}

.count {
  font-size: 80px;
  text-shadow: #000 2px 2px;
}

.buttons-container {
  color: #fff;
  text-transform: uppercase;
  font-size: 16px;
  margin: 0 auto;
  padding: 6px 12px;
  align-items: center;
  justify-content: space-between;
  display: flex;
  flex-wrap: wrap;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  min-width: 320px;
  max-width: 480px;
}

[role=button] {
  cursor: pointer;
  user-select: none;
}

.contrast {
  position: absolute;
  visibility: hidden;
}

a {
  text-decoration: none;
}

.slider {
  user-select: none;
  display: flex;
  align-items: center;
  flex: 1 0 100%;
  font-size: 10px;
  margin-bottom: 12px;
}

.slider :first-child {
  margin-right: 6px;
}

.slider input {
  flex: 1;
}

.slider .button {
  margin-left: 6px;
}

.button {
  padding: 6px;
  border: 2px solid currentColor;
}

.button.off {
  opacity: .5;
}

.button.retake,
.button.save {
  margin: 16px;
  padding: 16px;
}

input[type=range] {
  -webkit-appearance: none;
  width: 100%;
  margin: 16px 0;
}
input[type=range]:focus {
  outline: none;
}
input[type=range]::-webkit-slider-runnable-track {
  width: 100%;
  height: 0;
  cursor: pointer;
  box-shadow: none;
  background: #fff;
  border-radius: 0;
  border: 4px solid #fff;
}
input[type=range]::-webkit-slider-thumb {
  border: none;
  height: 18px;
  box-shadow: 3px 0 0 #000;
  width: 18px;
  border-radius: 0;
  background: #fff;
  cursor: pointer;
  -webkit-appearance: none;
  margin-top: -8px;
}
input[type=range]:focus::-webkit-slider-runnable-track {
  background: #fff;
}
input[type=range]::-moz-range-track {
  width: 100%;
  height: 0;
  cursor: pointer;
  box-shadow: none;
  background: #fff;
  border-radius: 0;
  border: 2px solid #fff;
}
input[type=range]::-moz-range-thumb {
  border: none;
  height: 18px;
  box-shadow: 3px 0 0 #000;
  width: 18px;
  border-radius: 0;
  background: #fff;
  cursor: pointer;
}
input[type=range]::-ms-track {
  width: 100%;
  height: 0;
  cursor: pointer;
  background: transparent;
  border-color: transparent;
  color: transparent;
}
input[type=range]::-ms-fill-lower {
  background: #fff;
  border: 2px solid #fff;
  border-radius: 0;
  box-shadow: none;
}
input[type=range]::-ms-fill-upper {
  background: #fff;
  border: 2px solid #fff;
  border-radius: 0;
  box-shadow: none;
}
input[type=range]::-ms-thumb {
  border: none;
  height: 18px;
  box-shadow: 3px 0 0 #000;
  width: 18px;
  border-radius: 0;
  background: #fff;
  cursor: pointer;
  height: 0;
}
input[type=range]:focus::-ms-fill-lower {
  background: #fff;
}
input[type=range]:focus::-ms-fill-upper {
  background: #fff;
}
</style>