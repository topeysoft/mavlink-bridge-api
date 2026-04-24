<template>
  <div class="copy-block" :class="{ 'copy-block-multiline': multiline }">
    <pre tabindex="0"><code>{{ value }}</code></pre>
    <button
      type="button"
      class="copy-btn"
      :aria-label="copied ? copiedLabel : `${copyLabel} command`"
      @click="copy"
    >
      <component :is="getIcon(copied ? 'check-circle' : 'copy')" :size="14" :stroke-width="2" />
      <span aria-live="polite">{{ copied ? copiedLabel : copyLabel }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { getIcon } from '@/utils/iconMap'

const props = withDefaults(defineProps<{
  value: string
  copyLabel: string
  copiedLabel: string
  multiline?: boolean
}>(), {
  multiline: false
})

const copied = ref(false)
let resetTimer: ReturnType<typeof setTimeout> | null = null

async function copy() {
  try {
    await navigator.clipboard.writeText(props.value)
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = props.value
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    try {
      document.execCommand('copy')
    } finally {
      document.body.removeChild(textarea)
    }
  }
  copied.value = true
  if (resetTimer) clearTimeout(resetTimer)
  resetTimer = setTimeout(() => {
    copied.value = false
  }, 2000)
}
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.copy-block {
  position: relative;
  display: flex;
  align-items: stretch;
  gap: 0;
  background: #1e1e1e;
  border-radius: 6px;
  overflow: hidden;
  margin-top: 0.25rem;
}

.copy-block-multiline {
  flex-direction: column;

  pre {
    white-space: pre-wrap;
    word-break: break-all;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .copy-btn {
    align-self: flex-end;
    border-left: none;
    border-top: none;
    padding: 0.5rem 1rem;
  }
}

pre {
  flex: 1;
  margin: 0;
  padding: 0.6rem 0.85rem;
  overflow-x: auto;
  color: #e0e0e0;
  font-family: 'SF Mono', 'Monaco', 'Consolas', 'Courier New', monospace;
  font-size: 0.82rem;
  line-height: 1.45;
  white-space: pre;

  &:focus {
    outline: 2px solid rgba($primary, 0.8);
    outline-offset: -2px;
  }
}

code {
  font-family: inherit;
}

.copy-btn {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0 0.9rem;
  background: rgba(255, 255, 255, 0.08);
  border: none;
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  color: #e0e0e0;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
  white-space: nowrap;

  &:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  &:focus-visible {
    outline: 2px solid rgba($primary, 0.8);
    outline-offset: -2px;
  }
}
</style>
