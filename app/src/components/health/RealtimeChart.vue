<template>
  <q-card>
    <q-card-section>
      <div class="row items-center q-mb-sm">
        <div class="col">
          <div class="text-h6">{{ title }}</div>
        </div>
        <div class="col-auto">
          <q-btn-toggle
            v-model="timeRange"
            toggle-color="primary"
            size="sm"
            :options="[
              { label: '1m', value: 60 },
              { label: '5m', value: 300 },
              { label: '15m', value: 900 }
            ]"
          />
        </div>
      </div>
      
      <div ref="chartContainer" class="chart-container"></div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useQuasar } from 'quasar'

interface DataPoint {
  timestamp: number
  value: number
}

interface Props {
  title: string
  data: DataPoint[]
  unit?: string
  color?: string
  yMin?: number
  yMax?: number
}

const props = withDefaults(defineProps<Props>(), {
  unit: '',
  color: '#1976d2',
  yMin: 0,
  yMax: 100
})

const $q = useQuasar()
const chartContainer = ref<HTMLElement>()
const timeRange = ref(300) // 5 minutes default
let resizeObserver: ResizeObserver | null = null

// Simple canvas-based chart for performance
function drawChart() {
  if (!chartContainer.value) return
  
  const canvas = chartContainer.value.querySelector('canvas') as HTMLCanvasElement
  if (!canvas) return
  
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  
  const width = canvas.width
  const height = canvas.height
  const padding = 40
  
  // Clear canvas
  ctx.clearRect(0, 0, width, height)
  
  // Filter data by time range
  const now = Date.now()
  const filteredData = props.data.filter(d => 
    (now - d.timestamp) / 1000 <= timeRange.value
  )
  
  if (filteredData.length < 2) return
  
  // Calculate scales
  const xScale = (width - padding * 2) / timeRange.value
  const yScale = (height - padding * 2) / (props.yMax - props.yMin)
  
  // Draw grid
  ctx.strokeStyle = $q.dark.isActive ? '#333' : '#e0e0e0'
  ctx.lineWidth = 1
  
  // Y-axis grid
  for (let i = 0; i <= 5; i++) {
    const y = padding + (i * (height - padding * 2) / 5)
    ctx.beginPath()
    ctx.moveTo(padding, y)
    ctx.lineTo(width - padding, y)
    ctx.stroke()
    
    // Y-axis labels
    ctx.fillStyle = $q.dark.isActive ? '#aaa' : '#666'
    ctx.font = '12px sans-serif'
    ctx.textAlign = 'right'
    const value = props.yMax - (i * (props.yMax - props.yMin) / 5)
    ctx.fillText(`${value}${props.unit}`, padding - 5, y + 4)
  }
  
  // Draw line
  ctx.strokeStyle = props.color
  ctx.lineWidth = 2
  ctx.beginPath()
  
  filteredData.forEach((point, index) => {
    const x = padding + ((now - point.timestamp) / 1000) * xScale
    const y = padding + (props.yMax - point.value) * yScale
    
    if (index === 0) {
      ctx.moveTo(width - x, y)
    } else {
      ctx.lineTo(width - x, y)
    }
  })
  
  ctx.stroke()
  
  // Draw area fill
  ctx.fillStyle = props.color + '20'
  ctx.lineTo(width - padding, height - padding)
  ctx.lineTo(padding, height - padding)
  ctx.closePath()
  ctx.fill()
}

function resizeCanvas() {
  if (!chartContainer.value) return
  
  const canvas = document.createElement('canvas')
  canvas.width = chartContainer.value.clientWidth
  canvas.height = 200
  
  chartContainer.value.innerHTML = ''
  chartContainer.value.appendChild(canvas)
  
  drawChart()
}

watch([() => props.data, timeRange], () => {
  drawChart()
})

onMounted(() => {
  resizeCanvas()
  
  // Use ResizeObserver for better performance
  if (chartContainer.value) {
    resizeObserver = new ResizeObserver(() => {
      resizeCanvas()
    })
    resizeObserver.observe(chartContainer.value)
  }
})

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
  }
})
</script>

<style lang="scss" scoped>
.chart-container {
  width: 100%;
  height: 200px;
  position: relative;
}
</style>