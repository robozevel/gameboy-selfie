<template>
  <div :style="{ maxWidth: fit ? `${canvasWidth}px` : `${frameWidth}px` }">
    <video ref="video" muted autoplay playsinline @play="onPlay" @loadedmetadata="play"></video>
    <canvas ref="canvas" :height="frameHeight" :width="frameWidth"></canvas>
    <canvas ref="resizedCanvas" hidden></canvas>
    <slot />
  </div>
</template>

<script>
import onVisibilityChange from '~/mixins/on-visibility-change'

const webcamSupported = process.browser && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function'

const isSafari = () => {
  const ua = navigator.userAgent.toLowerCase()
  return ((ua.indexOf('safari') !== -1) && (ua.indexOf('chrome') === -1))
}

function getImage (src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.src = src
    img.onload = () => resolve(img)
    img.onerror = err => reject(err)
  })
}

export default {
  name: 'Gameboy',
  mixins: [
    onVisibilityChange(function (hidden) {
      const { video } = this.$refs
      if (!video || this.captured) return
      video[hidden ? 'pause' : 'play']()
    })
  ],
  props: {
    fit: {
      type: Boolean,
      default: true
    },
    scale: {
      type: Number,
      default: 1,
    },
    maxScale: {
      type: Number,
      default: 2,
    },
    zoom: {
      type: Number,
      default: 1,
    },
    selfie: {
      type: Boolean,
      default: true
    },
    options: {
      type: Object,
      default: () => ({
        highContrast: false,
        brightness: 1,
        threshold: 135,
        palette: [null, [
          [0, 0, 0],
          [128, 128, 128],
          [192, 192, 192],
          [255, 255, 255]
        ]]
      })
    }
  },
  data () {
    return {
      webcamSupported,
      originalPadding: 16,
      originalHeight: 112,
      originalWidth: 128,
      videoHeight: 0,
      videoWidth: 0,
      frameImages: {},
      frameColors: [0, 128, 192, 255],
      // Bayer threshold map
      thresholdMap: [
        [15, 135, 45, 165],
        [195, 75, 225, 105],
        [60, 180, 30, 150],
        [240, 120, 210, 90]
      ]
    }
  },
  async mounted () {
    // get frame image data
    this.frameImages = {
      user: await getImage('frame-user.png'),
      environment: await getImage('frame-environment.png')
    }
 
    this.initialize()
  },
  computed: {
    colors () {
      const { palette } = Object(this.options)
      return palette && palette[1]
    },
    frameImage () {
      return this.frameImages[this.facingMode]
    },
    facingMode () {
      return this.selfie ? 'user' : 'environment'
    },
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
      return this.frameWidth * this.zoom
    },
    resizedHeight () {
      return this.resizedWidth * this.ratio
    },
    croppedWidth () {
      return this.frameWidth - (this.padding * 2)
    },
    croppedHeight () {
      return this.frameHeight - (this.padding * 2)
    },
    dx () {
      if (this.selfie) {
        return (this.resizedWidth / 2) - (this.frameWidth / 2) - this.resizedWidth
      } else {
        return (this.resizedWidth / 2) + (this.frameWidth / 2) - this.resizedWidth
      }
    },
    dy () {
      return ((this.resizedHeight / 2) - (this.fitHeight / 2)) * -1
    },
    canvasWidth () {
      return ((this.originalPadding * 2) + this.originalWidth) * (this.maxScale + 1)
    },
    ratio () {
      return this.videoHeight / this.videoWidth
    }
  },
  methods: {
    async initialize () {
      await this.$nextTick()
      try {
        if (!this.webcamSupported) throw new Error('Webcam not supported')

        const { video } = this.$refs
  
        // stop previous stream
        if (video.srcObject) video.srcObject.getTracks().map(track => track.stop())

        // set stream to video element
        video.srcObject = await this.getUserMedia()

        // list devices
        const devices = await this.getDevices()
        this.$emit('ready', { devices })

      } catch (err) {
        console.error(err)
        alert(err.message)
      }
    },
    async getDevices () {
      const devices = await navigator.mediaDevices.enumerateDevices()
      return devices.filter(device => device.kind === 'videoinput')
    },
    async getUserMedia () {
      const constraints = {
        audio: false,
        video: {
          aspectRatio: { ideal: 1 },
          facingMode: isSafari() ? { exact: this.facingMode } : this.facingMode
        }
      }

      return navigator.mediaDevices.getUserMedia(constraints)
    },
    play () {
      this.$refs.video.play()
    },
    async onPlay () {
      await this.$nextTick()
      const { video } = this.$refs
      this.videoWidth = video.videoWidth
      this.videoHeight = video.videoHeight
      requestAnimationFrame(this.timerCallback)
    },
    timerCallback () {
      const { video } = this.$refs
      if (!video || video.paused || video.ended) return
      this.draw()
      requestAnimationFrame(this.timerCallback)
    },
    draw () {
      const { video, canvas } = this.$refs
      const { width, height } = canvas

      // keep it pixelated
      const ctx = canvas.getContext('2d')
      ctx.mozImageSmoothingEnabled = false
      ctx.webkitImageSmoothingEnabled = false
      ctx.msImageSmoothingEnabled = false
      ctx.imageSmoothingEnabled = false

      // mirror video stream
      ctx.setTransform(this.selfie ? -1 : 1, 0, 0, 1, 0, 0)

      // resize and process video
      ctx.drawImage(video, this.dx, this.dy, this.resizedWidth, this.resizedHeight)
      const image = this.processImage(ctx.getImageData(0, 0, width, height))

      // process frame image
      ctx.drawImage(this.frameImage, this.selfie ? -width : 0, 0, width, height)
      const frame = this.processFrame(ctx.getImageData(0, 0, width, height))
      
      // draw frame and image
      ctx.putImageData(frame, 0, 0)
      ctx.putImageData(image, 0, 0, this.padding, this.padding, this.croppedWidth, this.croppedHeight)
    },
    processImage (image) {
      const { length } = image.data
      const { thresholdMap, colors } = this
      const { threshold, highContrast, brightness } = Object(this.options)

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

      return image
    },
    processFrame (image) {
      const { frameColors, colors } = this

      for (let i = 0; i < image.data.length; i += 4) {
        let colorIndex = frameColors.indexOf(image.data[i])
        if (colorIndex === -1) continue
        let [r, g, b] = colors[colorIndex]
        image.data[i] = r
        image.data[i + 1] = g
        image.data[i + 2] = b
      }

      return image
    },
    capture () {
      const { resizedCanvas, canvas } = this.$refs
      const resizeFactor = 4 / this.scale
      resizedCanvas.width = canvas.width * resizeFactor
      resizedCanvas.height = canvas.height * resizeFactor

      const ctx = resizedCanvas.getContext('2d')
      ctx.mozImageSmoothingEnabled = false
      ctx.webkitImageSmoothingEnabled = false
      ctx.msImageSmoothingEnabled = false
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(canvas, 0, 0, resizedCanvas.width, resizedCanvas.height)

      return resizedCanvas.toDataURL('image/png')
    }
  },
  watch: {
    selfie: 'initialize'
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
</style>