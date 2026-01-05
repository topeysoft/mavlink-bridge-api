<script setup lang="ts">
import { ref } from 'vue'
import Card from '@/components/common/Card.vue'
import FormInput from '@/components/common/FormInput.vue'
import Button from '@/components/common/Button.vue'

const deviceName = ref('YR-2024-001')
const ipAddress = ref('192.168.1.100')
const mavlinkPort = ref('14550')
const ros2Domain = ref('0')
const autoConnect = ref(true)

const handleSave = () => {
  console.log('Saving connection settings...')
}
</script>

<template>
  <Card title="Connection Settings">
    <div class="settings-form">
      <FormInput
        v-model="deviceName"
        label="Device Name"
        placeholder="YR-2024-001"
      />

      <FormInput
        v-model="ipAddress"
        label="IP Address"
        placeholder="192.168.1.100"
      />

      <FormInput
        v-model="mavlinkPort"
        label="MAVLink Port"
        type="number"
        placeholder="14550"
      />

      <FormInput
        v-model="ros2Domain"
        label="ROS2 Domain ID"
        type="number"
        placeholder="0"
      />

      <div class="form-group">
        <label class="toggle-label">
          <input v-model="autoConnect" type="checkbox" class="toggle-input" />
          <span class="toggle-switch"></span>
          <span class="toggle-text">Auto-connect on startup</span>
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
