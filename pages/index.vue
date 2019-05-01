<template>
  <main>
    <div class="image-container" :style="{ maxWidth: fitScale ? `${canvasWidth}px` : `${frameWidth}px` }">
      <video ref="video" muted autoplay playsinline @play="onPlay" @loadedmetadata.once="play"></video>
      <canvas ref="canvas" :height="frameHeight" :width="frameWidth"></canvas>
      <div class="overlay" role="button" @click="capture" :class="{ 'show-instructions': showInstructions }">
        <span class="count" v-if="showCount">{{ count }}</span>
        <img :src="captured" v-else-if="captured" />
      </div>
    </div>

    <div class="buttons-container" :style="{ maxWidth: `${canvasWidth}px` }" v-if="!showCount">
      <template v-if="captured">
        <span class="button retake" role="button" @click="retake">retake</span>
        <a class="button save" role="button" :href="captured" :download="filename">save</a>
      </template>
      <template v-else>
        <div class="slider">
          <span>zoom</span>
          <input type="range" :min="minZoom" step="0.1" :max="maxZoom" v-model="zoom" />
          <span role="button" class="button" :class="{ off: !fitScale }" @click="fitScale = !fitScale">fit</span>
          <span role="button" class="button" @click="scaleUp">{{ scale }}x</span>
        </div>
        <div class="slider">
          <span>contrast</span>
          <input type="range" v-model="threshold" min="0" step="5" max="255" />
          <span role="button" class="button" :class="{ off: !highContrast }" @click="highContrast = !highContrast">hi</span>
        </div>
        <div class="slider">
          <span>brightness</span>
          <input type="range" v-model="brightness" min="1" step="0.1" max="10" />
        </div>
        <div class="palettes">
          <palette role="button" @click.native="paletteIndex = i" v-for="(palette, i) in palettes" :palette="palette" :selected="paletteIndex === i" :key="i" />
        </div>
      </template>
    </div>

  </main>
</template>

<script>
import palette from '~/components/palette'
import PALETTES from '~/palettes'

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const webcamSupported = process.browser && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function'

const constraints = {
  audio: false,
  video: {
    facingMode: 'user',
    aspectRatio: { ideal: 1 }
  }
}

const BAYER_THRESHOLD_MAP = [
  [15, 135, 45, 165],
  [195, 75, 225, 105],
  [60, 180, 30, 150],
  [240, 120, 210, 90]
]

function getImage (src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.src = src
    img.onload = () => resolve(img)
    img.onerror = err => reject(err)
  })
}

export default {
  components: {
    palette
  },
  data () {
    return {
      thresholdMap: BAYER_THRESHOLD_MAP,
      palettes: PALETTES,
      paletteIndex: 0,
      brightness: 1,
      zoom: 1,
      minZoom: 1,
      maxZoom: 5,
      showVideo: true,
      frameImage: null,
      frameColors: [0, 128, 192, 255],
      timestamp: null,
      fitScale: true,
      highContrast: false,
      scale: 1,
      maxScale: 3,
      threshold: 135,
      videoHeight: 0,
      videoWidth: 0,
      showCount: false,
      count: null,
      captured: null,
      originalPadding: 16,
      originalHeight: 112,
      originalWidth: 128,
      webcamSupported
    }
  },
  mounted () {
    document.addEventListener('visibilitychange', this.onVisibilityChange)
    this.initialize()
  },
  beforeDestroy () {
    document.removeEventListener('visibilitychange', this.onVisibilityChange)
  },
  computed: {
    height () {
      return this.originalHeight * this.scale
    },
    width () {
      return this.originalWidth * this.scale
    },
    padding () {
      return this.originalPadding * this.scale
    },
    frameWidth () {
      return this.width + (this.padding * 2)
    },
    frameHeight () {
      return this.height + (this.padding * 2)
    },
    fitHeight () {
      return this.frameWidth * this.ratio
    },
    resizedWidth () {
      const zoom = Math.min(Math.max(this.zoom, this.minZoom), this.maxZoom)
      return this.frameWidth * zoom
    },
    resizedHeight () {
      return this.resizedWidth * this.ratio
    },
    dx () {
      return (this.resizedWidth / 2) - (this.frameWidth / 2) - this.resizedWidth
    },
    dy () {
      return ((this.resizedHeight / 2) - (this.fitHeight / 2)) * -1
    },
    canvasWidth () {
      return ((this.originalPadding * 2) + this.originalWidth) * this.maxScale
    },
    ratio () {
      return this.videoHeight / this.videoWidth
    },
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
    async initialize () {
      await this.$nextTick()
      try {
        if (!this.webcamSupported) throw new Error('Webcam not supported')
        const { video, frameCanvas } = this.$refs

        // get frame image data
        this.frameImage = await getImage('frame.png')
        // set stream to video element
        video.srcObject = await navigator.mediaDevices.getUserMedia(constraints)
      } catch (err) {
        // @TODO handle error!
      }
    },
    async onPlay () {
      await this.$nextTick()
      const { video } = this.$refs
      this.videoWidth = video.videoWidth
      this.videoHeight = video.videoHeight
      this.timerCallback()
    },
    timerCallback () {
      const { video } = this.$refs
      if (!video || video.paused || video.ended) return
      this.computeFrame()
      setTimeout(this.timerCallback, 1000 / 60)
    },
    onVisibilityChange () {
      const { video } = this.$refs
      if (!video || this.captured) return
      video[document.hidden ? 'pause' : 'play']()
    },
    play () {
      this.$refs.video.play()
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
    computeFrame () {
      const { video, canvas } = this.$refs
      const {
        frameImage, frameWidth, frameHeight,
        resizedWidth, resizedHeight, dx, dy, padding,
        thresholdMap, threshold, highContrast, brightness, palette, frameColors
      } = this

      const [, colors] = palette

      const ctx = canvas.getContext('2d')
      ctx.mozImageSmoothingEnabled = false
      ctx.webkitImageSmoothingEnabled = false
      ctx.msImageSmoothingEnabled = false
      ctx.imageSmoothingEnabled = false

      // mirror video stream
      ctx.setTransform(-1, 0, 0, 1, 0, 0)

      // resize video
      ctx.drawImage(video, dx, dy, resizedWidth, resizedHeight)

      // get current frame
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const { length } = image.data

      // iterate image pixels
      for (let i = 0; i < length; i += 4) {

        // increase luminance by brightness factor
        let luminance = brightness * Math.sqrt(
          Math.pow(image.data[i] * 0.299, 2) +
          Math.pow(image.data[i + 1] * 0.587, 2) +
          Math.pow(image.data[i + 2] * 0.114, 2)
        )

        // use threshold map to find greyscale value
        let x = i / 4 % image.width
        let y = Math.floor(i / 4 / image.width)
        let map = Math.floor((luminance + thresholdMap[x % 4][y % 4]) / 2)

        // set color by contrast threshold
        let colorIndex = 0
        if (map < threshold) {
          if (highContrast) colorIndex = 0
          else colorIndex = map < (threshold / 2) ? 0 : 1;
        } else {
          if (highContrast) colorIndex = 3
          else colorIndex = map > (threshold * 2) ? 3 : 2;
        }

        let [r, g, b] = colors[colorIndex]
        image.data[i] = r
        image.data[i + 1] = g
        image.data[i + 2] = b
      }

      // 
      ctx.drawImage(frameImage, -canvas.width, 0, canvas.width, canvas.height)
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height)

      for (let i = 0; i < frame.data.length; i += 4) {
        let colorIndex = frameColors.indexOf(frame.data[i])
        if (colorIndex === -1) continue
        let [r, g, b] = colors[colorIndex]
        frame.data[i] = r
        frame.data[i + 1] = g
        frame.data[i + 2] = b
      }

      // draw frame image
      ctx.putImageData(frame, 0, 0)

      // draw image
      ctx.putImageData(image, 0, 0, padding, padding, frameWidth - padding * 2, frameHeight - padding * 2)
    },
    async capture () {
      if (this.captured || this.showCount) return
      await this.countdownSeconds(3)
      if (this.video) this.video.pause()
      this.captured = this.$refs.canvas.toDataURL('image/png')
      this.timestamp = (new Date()).toISOString()
    },
    retake () {
      this.captured = null
      this.timestamp = null
      this.play()
    }
  }
}
</script>

<style scoped>
.palettes {
  display: flex;
  flex-wrap: nowrap;
  overflow: auto;
}

video {
  display: none;
}

canvas {
  width: 100%;
  image-rendering: pixelated;
}

h1 {
  color: #fff;
  position: relative;
  text-align: center;
  margin: 0 auto;
}

.image-container {
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