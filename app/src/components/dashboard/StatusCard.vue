<script setup lang="ts">
import { ref } from 'vue'

const systemStatus = ref({
  mode: 'Standby',
  gps: '3D Fix',
  battery: 87,
  attachment: 'Mower Deck',
  status: 'Ready'
})
