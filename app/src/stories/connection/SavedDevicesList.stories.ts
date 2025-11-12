import type { Meta, StoryObj } from '@storybook/vue3';
import { createPinia, setActivePinia } from 'pinia';
import SavedDevicesList from '@/components/connection/SavedDevicesList.vue';

const meta: Meta<typeof SavedDevicesList> = {
  title: 'connection/SavedDevicesList',
  component: SavedDevicesList,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  decorators: [
    () => {
      setActivePinia(createPinia());
      return { template: '<story />' };
    },
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    devices: [
      {
        name: 'YardRover Alpha',
        ip: '192.168.1.100',
        port: 8080,
        hostname: 'yardrover-001',
        chipModel: 'ESP32-S3',
        version: '2.1.0',
        macAddress: '24:6f:28:b3:25:84',
        services: {
          http: 8080,
          websocket: 8081,
        },
        lastSeen: new Date(),
        isFavorite: true,
        nickname: 'Alpha Unit',
      },
      {
        name: 'YardRover Beta',
        ip: '192.168.1.101',
        port: 8080,
        hostname: 'yardrover-002',
        chipModel: 'ESP32-S3',
        version: '2.0.5',
        macAddress: '24:6f:28:b3:25:85',
        services: {
          http: 8080,
          websocket: 8081,
        },
        lastSeen: new Date(Date.now() - 3600000), // 1 hour ago
        isFavorite: false,
        nickname: 'Beta Unit',
      },
    ],
    hideActions: false,
  },
};
