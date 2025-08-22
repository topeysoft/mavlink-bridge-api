<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    persistent
  >
    <q-card style="min-width: 450px">
      <q-card-section>
        <div class="text-h6">Edit Parameter</div>
        <div class="text-caption text-grey-7" v-if="parameter">
          {{ parameter.name }}
        </div>
      </q-card-section>

      <q-form @submit="handleSave" v-if="parameter">
        <q-card-section>
          <div class="q-mb-md" v-if="parameter.description">
            <div class="text-subtitle2">Description</div>
            <div class="text-body2">{{ parameter.description }}</div>
          </div>

          <!-- Value input based on type -->
          <div v-if="parameter.values">
            <q-select
              v-model="editValue"
              :options="valueOptions"
              label="Value"
              emit-value
              map-options
              :rules="[val => val !== null && val !== undefined || 'Value is required']"
            />
          </div>
          <div v-else>
            <q-input
              v-model.number="editValue"
              label="Value"
              type="number"
              :step="inputStep"
              :rules="validationRules"
            >
              <template v-slot:hint>
                <div>
                  Current: {{ formatValue(parameter.value) }}
                  <span v-if="parameter.defaultValue !== undefined">
                    | Default: {{ formatValue(parameter.defaultValue) }}
                  </span>
                  <span v-if="parameter.range">
                    | Range: {{ parameter.range.min }} - {{ parameter.range.max }}
                  </span>
                  <span v-if="parameter.units">
                    | Units: {{ parameter.units }}
                  </span>
                </div>
              </template>
            </q-input>
          </div>

          <!-- Value changes preview -->
          <q-banner
            v-if="valueChanged"
            :class="`bg-${changeColor} text-white q-mt-md`"
            rounded
          >
            <template v-slot:avatar>
              <q-icon :name="changeIcon" />
            </template>
            <div>
              {{ parameter.value }} → {{ editValue }}
              <div class="text-caption">
                {{ changeDescription }}
              </div>
            </div>
          </q-banner>

          <!-- Validation warnings -->
          <q-banner
            v-if="validationWarnings.length > 0"
            class="bg-warning text-white q-mt-md"
            rounded
          >
            <template v-slot:avatar>
              <q-icon name="warning" />
            </template>
            <div>
              <div v-for="warning in validationWarnings" :key="warning">
                {{ warning }}
              </div>
            </div>
          </q-banner>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn
            flat
            label="Reset to Default"
            color="orange"
            @click="resetToDefault"
            v-if="parameter.defaultValue !== undefined"
          />
          <q-btn
            flat
            label="Save"
            color="primary"
            type="submit"
            :disable="!valueChanged || hasValidationErrors"
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { MAVLinkParameter } from '../../stores/mavlink-parameters'

interface Props {
  modelValue: boolean
  parameter: (MAVLinkParameter & { name: string }) | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  save: [name: string, value: number]
}>()

const editValue = ref<number>(0)
const hasValidationErrors = ref(false)

const valueOptions = computed(() => {
  if (!props.parameter?.values) return []
  
  return Object.entries(props.parameter.values).map(([value, description]) => ({
    label: `${value}: ${description}`,
    value: Number(value)
  }))
})

const inputStep = computed(() => {
  if (!props.parameter) return 'any'
  return props.parameter.type === 'float' || props.parameter.type === 'real32' ? 'any' : '1'
})

const validationRules = computed(() => {
  if (!props.parameter) return []
  
  const rules: Array<(val: number) => boolean | string> = [
    val => val !== null && val !== undefined || 'Value is required'
  ]
  
  if (props.parameter.range) {
    const { min, max } = props.parameter.range
    rules.push(val => val >= min || `Value must be >= ${min}`)
    rules.push(val => val <= max || `Value must be <= ${max}`)
  }
  
  if (props.parameter.type === 'int' || props.parameter.type === 'int32' || props.parameter.type === 'uint32') {
    rules.push(val => Number.isInteger(val) || 'Value must be an integer')
  }
  
  return rules
})

const validationWarnings = computed(() => {
  const warnings: string[] = []
  
  if (!props.parameter) return warnings
  
  const value = editValue.value
  
  // Check for potentially dangerous values
  if (props.parameter.name.includes('SYSID') && value === 0) {
    warnings.push('Setting SYSID to 0 may cause communication issues')
  }
  
  if (props.parameter.name.includes('RATE') && value > 100) {
    warnings.push('High rate values may affect performance')
  }
  
  return warnings
})

const valueChanged = computed(() => {
  return props.parameter && editValue.value !== props.parameter.value
})

const changeColor = computed(() => {
  if (!valueChanged.value) return 'grey'
  
  const diff = Math.abs(editValue.value - props.parameter!.value)
  const current = Math.abs(props.parameter!.value)
  const percentChange = current > 0 ? (diff / current) * 100 : 100
  
  if (percentChange > 50) return 'warning'
  if (percentChange > 10) return 'info'
  return 'positive'
})

const changeIcon = computed(() => {
  if (!valueChanged.value) return 'info'
  if (editValue.value > props.parameter!.value) return 'mdi-trending-up'
  return 'mdi-trending-down'
})

const changeDescription = computed(() => {
  if (!valueChanged.value) return ''
  
  const diff = editValue.value - props.parameter!.value
  const percentChange = props.parameter!.value !== 0 
    ? Math.abs(diff / props.parameter!.value) * 100 
    : 100
  
  return `${diff > 0 ? 'Increase' : 'Decrease'} of ${percentChange.toFixed(1)}%`
})

function formatValue(value: number): string {
  if (Number.isInteger(value)) {
    return value.toString()
  }
  return value.toFixed(6).replace(/\.?0+$/, '')
}

function resetToDefault() {
  if (props.parameter?.defaultValue !== undefined) {
    editValue.value = props.parameter.defaultValue
  }
}

function handleSave() {
  if (props.parameter && valueChanged.value) {
    emit('save', props.parameter.name, editValue.value)
  }
}

// Reset form when parameter changes
watch(() => props.parameter, (param) => {
  if (param) {
    editValue.value = param.value
  }
}, { immediate: true })
</script>