<template>
  <main class="container">

    <div class="image-container">
      <video ref="video" muted autoplay playsinline @play="onPlay" @loadedmetadata.once="play"></video>
      <canvas ref="canvas" :height="frameHeight" :width="frameWidth" :style="{ width: fitScale ? `${canvasWidth}px` : undefined }"></canvas>
      <div class="overlay" @click="capture" role="button">
        <span class="count" v-if="showCount">{{ count }}</span>
        <img :src="captured" v-else-if="captured" />
      </div>
    </div>

    <div class="buttons-container" :style="{ maxWidth: `${canvasWidth}px` }">
      <template v-if="captured">
        <span class="button" role="button" @click="retake">retake</span>
        <a class="button" role="button" :href="captured" :download="filename">save</a>
      </template>
      <template v-else>
        <input type="range" class="threshold" v-model="threshold" min="0" step="5" max="255" />
        <span class="button bw" :class="{ off: !grayscale }" role="button" @click="grayscale = !grayscale">B&W</span>
        <label class="button" role="button">
          <input type="checkbox" class="contrast" v-model="highContrast" />{{ highContrast ? 'hi' : 'low' }}
        </label>
        <span class="button fit-scale" role="button" @click="fitScale = !fitScale">{{ fitScale ? '⊠' : '⊡' }}</span>
        <span class="button" role="button" @click="scaleUp">{{ scale }}x</span>
      </template>
    </div>
  
  </main>
</template>

<script>
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const webcamSupported = process.browser && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function'

const constraints = {
  audio: false,
  video: {
    facingMode: 'user',
    aspectRatio: { ideal: 1 }
  }
}

const GRAYSCALE_COLORS = [
  [13, 13, 13],
  [103, 103, 103],
  [181, 181, 181],
  [253, 253, 253]
]

const GAMEBOY_COLORS = [
  [15, 56, 15],
  [48, 98, 48],
  [119, 161, 18],
  [155, 188, 15]
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
  data () {
    return {
      video: null,
      frameImage: null,
      timestamp: null,
      fitScale: true,
      grayscale: true,
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
  async mounted () {
    if (!this.webcamSupported) return
    const { video } = this.$refs
    if (!video) return
    try {
      this.frameImage = await getImage('frame.png')
      video.srcObject = await navigator.mediaDevices.getUserMedia(constraints)
    } catch (err) {
      // @TODO handle error!
    }
    document.addEventListener('visibilitychange', this.onVisibilityChange)
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
    canvasWidth () {
      return ((this.originalPadding * 2) + this.originalWidth) * this.maxScale
    },
    ratio () {
      return this.videoHeight / this.videoWidth
    },
    filename () {
      return `GAMEBOY_CAMERA_${this.timestamp}.png`
    },
    colors () {
      return this.grayscale ? GRAYSCALE_COLORS : GAMEBOY_COLORS
    }
  },
  methods: {
    onPlay () {
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
      const { frameImage, frameWidth, frameHeight, width, height, videoWidth, threshold, highContrast, colors, scale, padding, ratio } = this

      const ctx = canvas.getContext('2d')
      ctx.mozImageSmoothingEnabled = false
      ctx.webkitImageSmoothingEnabled = false
      ctx.msImageSmoothingEnabled = false
      ctx.imageSmoothingEnabled = false

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      ctx.setTransform(-1, 0, 0, 1, 0, 0)

      ctx.drawImage(video, (width + padding) * -1, padding, width, width * ratio)

      const image = ctx.getImageData(0, 0, width + padding, height + padding)
      const { length } = image.data

      // Bayer threshold map
      let thresholdMap = [
        [15, 135, 45, 165],
        [195, 75, 225, 105],
        [60, 180, 30, 150],
        [240, 120, 210, 90]
      ]

      for (let i = 0; i < length; i += 4) {
        let luminance = (image.data[i] * 0.299) + (image.data[i + 1] * 0.587) + (image.data[i + 2] * 0.114)

        let x = i / 4 % image.width
        let y = Math.floor(i / 4 / image.width)
        let map = Math.floor((luminance + thresholdMap[x % 4][y % 4]) / 2)

        let colorIndex = 0
        if (map < threshold) {
          if (highContrast) colorIndex = 0
          else colorIndex = map < (threshold / 2) ? 0 : 1;
        } else {
          if (highContrast) colorIndex = 3
          else colorIndex = map > (threshold / 2) ? 3 : 2;
        }

        let [r, g, b] = colors[colorIndex]
        image.data[i] = r
        image.data[i + 1] = g
        image.data[i + 2] = b
      }

      ctx.putImageData(image, 0, 0)
      if (frameImage) ctx.drawImage(frameImage, -frameWidth, 0, frameWidth, frameHeight)
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
.container {
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 0 auto;
  text-align: center;
  position: relative;
  max-width: 100%;
  padding: 32px;
  box-sizing: border-box;
}

video {
  display: none;
}

canvas {
  cursor: pointer;
  image-rendering: pixelated;
}

.image-container {
  display: block;
  position: relative;
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
  margin: 0 auto;
  font-family: monospace;
  box-sizing: border-box;
  align-items: center;
  justify-content: space-between;
  display: flex;
  flex-wrap: wrap;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
}

[role="button"] {
  cursor: pointer;
  user-select: none;
}

.contrast {
  position: absolute;
  visibility: hidden;
}

.threshold {
  flex-basis: 100%;
}

.button {
  color: #fff;
  text-shadow: #000 1px 1px;
  font-size: 24px;
  text-transform: uppercase;
  padding: 20px 15px;
}

.button.fit-scale {
  line-height: 24px;
  font-size: 42px;
  padding-right: 0;
}

.button.bw {
  padding-right: 5px;
}

.button.bw.off {
  text-decoration: line-through;
}

a.button {
  text-decoration: none;
}
</style>