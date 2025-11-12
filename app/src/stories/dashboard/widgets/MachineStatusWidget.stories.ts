import type { Meta, StoryObj } from '@storybook/vue3';
import { createPinia, setActivePinia } from 'pinia';
import MachineStatusWidget from '@/components/dashboard/widgets/MachineStatusWidget.vue';

const meta: Meta<typeof MachineStatusWidget> = {
  title: 'dashboard/widgets/MachineStatusWidget',
  component: MachineStatusWidget,
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
    widgetId: 'machine-status-widget-1',
  },
};
