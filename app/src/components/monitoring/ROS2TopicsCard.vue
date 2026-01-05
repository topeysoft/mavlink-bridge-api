<script setup lang="ts">
import { ref } from 'vue'
import Card from '@/components/common/Card.vue'

interface ROS2Topic {
  name: string
  type: string
  frequency: number
}

const topics = ref<ROS2Topic[]>([
  { name: '/cmd_vel', type: 'geometry_msgs/Twist', frequency: 50 },
  { name: '/odom', type: 'nav_msgs/Odometry', frequency: 30 },
  { name: '/imu', type: 'sensor_msgs/Imu', frequency: 100 },
  { name: '/gps/fix', type: 'sensor_msgs/NavSatFix', frequency: 10 },
  { name: '/battery_status', type: 'sensor_msgs/BatteryState', frequency: 1 }
])
</script>

<template>
  <Card title="ROS2 Topics">
    <div class="topics-list">
      <div v-for="topic in topics" :key="topic.name" class="topic-item">
        <div class="topic-info">
          <div class="topic-name">{{ topic.name }}</div>
          <div class="topic-type">{{ topic.type }}</div>
        </div>
        <div class="topic-frequency">
          {{ topic.frequency }} Hz
        </div>
      </div>
    </div>
  </Card>
</template>

<style scoped lang="scss">
.topics-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.topic-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md);
  background: var(--bg-secondary);
  border-radius: var(--border-radius);
  transition: background 0.2s;

  &:hover {
    background: var(--bg-tertiary);
  }
}

.topic-info {
  flex: 1;
}

.topic-name {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-primary);
  font-family: 'Monaco', 'Courier New', monospace;
  margin-bottom: var(--spacing-xs);
}

.topic-type {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  font-family: 'Monaco', 'Courier New', monospace;
}

.topic-frequency {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--primary-green);
  font-family: 'Monaco', 'Courier New', monospace;
}
</style>
