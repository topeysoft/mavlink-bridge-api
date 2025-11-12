import type { Meta, StoryObj } from '@storybook/vue3';
import { createPinia, setActivePinia } from 'pinia';
import SystemHealthWidget from '@/components/dashboard/widgets/SystemHealthWidget.vue';

const meta: Meta<typeof SystemHealthWidget> = {
  title: 'dashboard/widgets/SystemHealthWidget',
  component: SystemHealthWidget,
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
    widgetId: 'system-health-widget-1',
  },
};
