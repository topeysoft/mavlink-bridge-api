import type { Meta, StoryObj } from '@storybook/vue3';
import { createPinia, setActivePinia } from 'pinia';
import DeviceCard from '@/components/connection/DeviceCard.vue';

const meta: Meta<typeof DeviceCard> = {
  title: 'connection/DeviceCard',
  component: DeviceCard,
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
    device: {
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
    },
  },
};
