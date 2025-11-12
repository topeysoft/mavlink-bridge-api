import type { Meta, StoryObj } from '@storybook/vue3';
import { createPinia, setActivePinia } from 'pinia';
import TelemetryWidget from '@/components/dashboard/widgets/TelemetryWidget.vue';

const meta: Meta<typeof TelemetryWidget> = {
  title: 'dashboard/widgets/TelemetryWidget',
  component: TelemetryWidget,
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
    widgetId: 'telemetry-widget-1',
  },
};
