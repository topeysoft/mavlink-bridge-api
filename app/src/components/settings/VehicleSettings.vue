<script setup lang="ts">
import { ref } from 'vue'
import Card from '@/components/common/Card.vue'
import FormInput from '@/components/common/FormInput.vue'
import FormSelect from '@/components/common/FormSelect.vue'
import Button from '@/components/common/Button.vue'

const maxSpeed = ref('5.0')
const workingSpeed = ref('2.5')
const returnHomeBattery = ref('15')
const gpsFence = ref('50')
const obstacleAvoidance = ref(true)

const fenceOptions = [
  { value: '25', label: '25 meters' },
  { value: '50', label: '50 meters' },
  { value: '100', label: '100 meters' },
  { value: '200', label: '200 meters' }
]

const handleSave = () => {
  console.log('Saving vehicle settings...')
}
</script>

<template>
  <Card title="Vehicle Configuration">
    <div class="settings-form">
      <FormInput
        v-model="maxSpeed"
        label="Maximum Speed"
        type="number"
        placeholder="5.0"
      />

      <FormInput
        v-model="workingSpeed"
        label="Working Speed"
        type="number"
        placeholder="2.5"
      />

      <FormInput
        v-model="returnHomeBattery"
        label="Return Home Battery Level (%)"
        type="number"
        placeholder="15"
      />

      <FormSelect
        v-model="gpsFence"
        label="GPS Fence Radius"
        :options="fenceOptions"
      />

      <div class="form-group">
        <label class="toggle-label">
          <input v-model="obstacleAvoidance" type="checkbox" class="toggle-input" />
          <span class="toggle-switch"></span>
          <span class="toggle-text">Enable obstacle avoidance</span>
        </label>
      </div>

      <Button variant="primary" @click="handleSave">Save Settings</Button>
    </div>
  </Card>
</template>

<style scoped lang="scss">
.settings-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  cursor: pointer;
  user-select: none;
}

.toggle-input {
  display: none;
}

.toggle-switch {
  position: relative;
  width: 48px;
  height: 24px;
  background: var(--bg-tertiary);
  border-radius: 12px;
  transition: background 0.3s;

  &::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 20px;
    height: 20px;
    background: white;
    border-radius: 50%;
    transition: transform 0.3s;
  }
}

.toggle-input:checked + .toggle-switch {
  background: var(--primary-green);

  &::after {
    transform: translateX(24px);
  }
}

.toggle-text {
  font-size: var(--font-size-sm);
  color: var(--text-primary);
}
</style>
