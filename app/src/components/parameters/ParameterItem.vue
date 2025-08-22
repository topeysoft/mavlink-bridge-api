<template>
  <q-item
    clickable
    @click="$emit('edit', parameter)"
    :class="{ 'bg-blue-1': parameter.modified }"
  >
    <q-item-section avatar>
      <q-icon
        :name="typeIcon"
        :color="parameter.modified ? 'primary' : 'grey'"
      />
    </q-item-section>

    <q-item-section>
      <q-item-label class="parameter-name">
        {{ parameter.name }}
        <q-chip
          v-if="parameter.modified"
          label="Modified"
          size="sm"
          color="primary"
          text-color="white"
          dense
        />
      </q-item-label>
      <q-item-label caption v-if="parameter.description">
        {{ parameter.description }}
      </q-item-label>
    </q-item-section>

    <q-item-section side>
      <div class="text-right">
        <div class="text-subtitle2">{{ formattedValue }}</div>
        <div class="text-caption text-grey-7" v-if="parameter.units">
          {{ parameter.units }}
        </div>
        <div class="text-caption text-grey-7" v-if="parameter.range">
          Range: {{ parameter.range.min }} - {{ parameter.range.max }}
        </div>
      </div>
    </q-item-section>

    <q-item-section side>
      <div class="q-gutter-xs">
        <q-btn
          flat
          round
          dense
          icon="edit"
          @click.stop="$emit('edit', parameter)"
        >
          <q-tooltip>Edit parameter</q-tooltip>
        </q-btn>
        <q-btn
          v-if="parameter.modified"
          flat
          round
          dense
          icon="mdi-restore"
          @click.stop="$emit('reset', parameter)"
        >
          <q-tooltip>Reset to default</q-tooltip>
        </q-btn>
        <q-btn
          flat
          round
          dense
          icon="mdi-information"
          @click.stop="showInfo"
        >
          <q-tooltip>Parameter info</q-tooltip>
        </q-btn>
      </div>
    </q-item-section>

    <!-- Parameter Info Dialog -->
    <q-dialog v-model="showInfoDialog">
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">{{ parameter.name }}</div>
        </q-card-section>

        <q-card-section>
          <div class="parameter-info">
            <div class="row q-mb-md">
              <div class="col-4 text-grey-7">Type:</div>
              <div class="col">{{ parameter.type || 'Unknown' }}</div>
            </div>
            <div class="row q-mb-md">
              <div class="col-4 text-grey-7">Current:</div>
              <div class="col">{{ formattedValue }}</div>
            </div>
            <div class="row q-mb-md" v-if="parameter.defaultValue !== undefined">
              <div class="col-4 text-grey-7">Default:</div>
              <div class="col">{{ formatValue(parameter.defaultValue) }}</div>
            </div>
            <div class="row q-mb-md" v-if="parameter.range">
              <div class="col-4 text-grey-7">Range:</div>
              <div class="col">{{ parameter.range.min }} - {{ parameter.range.max }}</div>
            </div>
            <div class="row q-mb-md" v-if="parameter.units">
              <div class="col-4 text-grey-7">Units:</div>
              <div class="col">{{ parameter.units }}</div>
            </div>
            <div v-if="parameter.description">
              <div class="text-grey-7 q-mb-sm">Description:</div>
              <div>{{ parameter.description }}</div>
            </div>
            <div v-if="parameter.values" class="q-mt-md">
              <div class="text-grey-7 q-mb-sm">Valid Values:</div>
              <q-list dense>
                <q-item
                  v-for="(desc, val) in parameter.values"
                  :key="val"
                  dense
                >
                  <q-item-section avatar style="min-width: 40px">
                    {{ val }}:
                  </q-item-section>
                  <q-item-section>{{ desc }}</q-item-section>
                </q-item>
              </q-list>
            </div>
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Close" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-item>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { MAVLinkParameter } from '../../stores/mavlink-parameters'

interface Props {
  parameter: MAVLinkParameter & { name: string; modified?: boolean }
  index: number
}

const props = defineProps<Props>()

defineEmits<{
  edit: [parameter: MAVLinkParameter & { name: string }]
  reset: [parameter: MAVLinkParameter & { name: string }]
}>()

const showInfoDialog = ref(false)

const typeIcon = computed(() => {
  const type = props.parameter.type
  if (type === 'int' || type === 'int32' || type === 'uint32') return 'mdi-numeric'
  if (type === 'float' || type === 'real32') return 'mdi-decimal'
  return 'mdi-cog'
})

const formattedValue = computed(() => {
  return formatValue(props.parameter.value)
})

function formatValue(value: number): string {
  if (Number.isInteger(value)) {
    return value.toString()
  }
  return value.toFixed(6).replace(/\.?0+$/, '')
}

function showInfo() {
  showInfoDialog.value = true
}
</script>

<style lang="scss" scoped>
.parameter-name {
  font-family: monospace;
  font-weight: 500;
}

.parameter-info {
  font-size: 14px;
}
</style>