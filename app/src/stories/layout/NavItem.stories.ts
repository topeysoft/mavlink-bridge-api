import type { Meta, StoryObj } from '@storybook/vue3';
import { createPinia, setActivePinia } from 'pinia';
import NavItem from '@/components/layout/NavItem.vue';

const meta: Meta<typeof NavItem> = {
  title: 'layout/NavItem',
  component: NavItem,
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
    title: 'Dashboard',
    icon: 'dashboard',
    path: '/dashboard',
    color: 'primary',
  },
};
