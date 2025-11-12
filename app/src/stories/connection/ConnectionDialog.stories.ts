import type { Meta, StoryObj } from '@storybook/vue3';
import { createPinia, setActivePinia } from 'pinia';
import ConnectionDialog from '@/components/connection/ConnectionDialog.vue';

const meta: Meta<typeof ConnectionDialog> = {
  title: 'connection/ConnectionDialog',
  component: ConnectionDialog,
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
