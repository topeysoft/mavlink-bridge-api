import type { Meta, StoryObj } from '@storybook/vue3';
import { createPinia, setActivePinia } from 'pinia';
import ConnectionIndicator from '@/components/common/ConnectionIndicator.vue';

const meta: Meta<typeof ConnectionIndicator> = {
  title: 'common/ConnectionIndicator',
  component: ConnectionIndicator,
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
