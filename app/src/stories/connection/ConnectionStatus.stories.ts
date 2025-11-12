import type { Meta, StoryObj } from '@storybook/vue3';
import { createPinia, setActivePinia } from 'pinia';
import ConnectionStatus from '@/components/connection/ConnectionStatus.vue';

const meta: Meta<typeof ConnectionStatus> = {
  title: 'connection/ConnectionStatus',
  component: ConnectionStatus,
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
