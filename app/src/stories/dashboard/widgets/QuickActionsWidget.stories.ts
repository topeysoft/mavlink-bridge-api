import type { Meta, StoryObj } from '@storybook/vue3';
import { createPinia, setActivePinia } from 'pinia';
import QuickActionsWidget from '@/components/dashboard/widgets/QuickActionsWidget.vue';

const meta: Meta<typeof QuickActionsWidget> = {
  title: 'dashboard/widgets/QuickActionsWidget',
  component: QuickActionsWidget,
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
    widgetId: 'quick-actions-widget-1',
  },
};
