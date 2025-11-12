import type { Meta, StoryObj } from '@storybook/vue3';
import { createPinia, setActivePinia } from 'pinia';
import EmergencyStop from '@/components/dashboard/EmergencyStop.vue';

const meta: Meta<typeof EmergencyStop> = {
  title: 'dashboard/EmergencyStop',
  component: EmergencyStop,
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

export const Default: Story = {};
