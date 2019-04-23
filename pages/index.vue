<template>
  <main>
    <div class="image-container" :style="{ maxWidth: fitScale ? `${canvasWidth}px` : `${frameWidth}px` }">
      <video ref="video" muted autoplay playsinline @play="onPlay" @loadedmetadata.once="play"></video>
      <canvas ref="canvas" :height="frameHeight" :width="frameWidth"></canvas>
      <div class="overlay">
        <span class="count" v-if="showCount">{{ count }}</span>
        <img :src="captured" v-else-if="captured" />
      </div>
    </div>

    <div class="buttons-container" :style="{ maxWidth: `${canvasWidth}px` }" v-if="!showCount">
      <template v-if="captured">
        <span class="button" role="button" @click="retake">retake</span>
        <a class="button" role="button" :href="captured" :download="filename">save</a>
      </template>
      <template v-else>
        <input type="range" :min="minZoom" step="0.1" :max="maxZoom" v-model="zoom" />
        <input type="range" min="1" step="0.1" max="10" v-model="brightness" />
        <input type="range" class="threshold" v-model="threshold" min="0" step="5" max="255" />
        <span class="button" role="button" :class="{ off: !grayscale }" @click="grayscale = !grayscale">b&w</span>
        <span class="button" role="button" :class="{ off: !highContrast }" @click="highContrast = !highContrast">hi</span>
        <div class="button capture" role="button" @click="capture">@</div>
        <span class="button" role="button" :class="{ off: !fitScale }" @click="fitScale = !fitScale">fit</span>
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
      // Bayer threshold map
      thresholdMap: [
        [15, 135, 45, 165],
        [195, 75, 225, 105],
        [60, 180, 30, 150],
        [240, 120, 210, 90]
      ],
      brightness: 1,
      zoom: 1,
      minZoom: 1,
      maxZoom: 3,
      showVideo: true,
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
    colors () {
      return this.grayscale ? GRAYSCALE_COLORS : GAMEBOY_COLORS
    }
  },
  methods: {
    async initialize () {
      if (!this.webcamSupported) return
      await this.$nextTick()

      const { video } = this.$refs
      if (!video) return
      try {
        this.frameImage = await getImage('frame.png')
        video.srcObject = await navigator.mediaDevices.getUserMedia(constraints)
      } catch (err) {
        // @TODO handle error!
      }
    },
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
      const {
        frameImage, frameWidth, frameHeight,
        resizedWidth, resizedHeight, dx, dy,
        thresholdMap, threshold, highContrast, colors, brightness
      } = this

      const ctx = canvas.getContext('2d')
      ctx.mozImageSmoothingEnabled = false
      ctx.webkitImageSmoothingEnabled = false
      ctx.msImageSmoothingEnabled = false
      ctx.imageSmoothingEnabled = false

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      ctx.setTransform(-1, 0, 0, 1, 0, 0)

      ctx.drawImage(video, dx, dy, resizedWidth, resizedHeight)
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const { length } = image.data

      for (let i = 0; i < length; i += 4) {

        let luminance = brightness * Math.sqrt(
          Math.pow(image.data[i] * 0.299, 2) +
          Math.pow(image.data[i + 1] * 0.587, 2) +
          Math.pow(image.data[i + 2] * 0.114, 2)
        )

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

      // draw frame image
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

video {
  display: none;
}

canvas {
  width: 100%;
  image-rendering: pixelated;
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
  padding: 12px 6px;
  align-items: center;
  justify-content: space-between;
  display: flex;
  flex-wrap: wrap;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
}

.button.capture {
  font-size: 64px;
}

[type="range"] {
  margin-bottom: 12px;
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
  text-transform: uppercase;
  font-size: 16px;
  padding: 12px;
}

.button.off {
  opacity: .5;
}

a.button {
  text-decoration: none;
}
</style>