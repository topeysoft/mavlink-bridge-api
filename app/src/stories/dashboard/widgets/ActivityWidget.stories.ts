import type { Meta, StoryObj } from '@storybook/vue3';
import { createPinia, setActivePinia } from 'pinia';
import ActivityWidget from '@/components/dashboard/widgets/ActivityWidget.vue';

const meta: Meta<typeof ActivityWidget> = {
  title: 'dashboard/widgets/ActivityWidget',
  component: ActivityWidget,
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
    widgetId: 'activity-widget-1',
  },
};
