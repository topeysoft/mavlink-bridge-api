<script setup lang="ts">
import Breadcrumb from '@/components/common/Breadcrumb.vue'
import { useAttachmentsStore } from '@/stores/attachments'

const attachmentsStore = useAttachmentsStore()

const breadcrumbItems = [
  { label: 'Dashboard', to: '/' },
  { label: 'Attachments' }
]
</script>

<template>
  <div class="attachments-view">
    <Breadcrumb :items="breadcrumbItems" />

    <header class="page-header">
      <h1>Attachments</h1>
      <p class="subtitle">Manage your YardRover attachments</p>
    </header>

    <div class="attachments-grid">
      <div v-for="attachment in attachmentsStore.attachments" :key="attachment.id" class="attachment-card"
        :class="{ active: attachmentsStore.currentAttachment?.id === attachment.id, maintenance: attachment.status === 'maintenance' }">
        <div class="attachment-header">
          <span class="material-icons">extension</span>
          <span class="status-badge" :class="attachment.status">{{ attachment.status }}</span>
        </div>
        <h3>{{ attachment.name }}</h3>
        <p class="type">{{ attachment.type }}</p>
        <div class="stats">
          <div class="stat">
            <span class="label">Hours:</span>
            <span class="value">{{ attachment.hours }}</span>
          </div>
          <div class="stat">
            <span class="label">Last Service:</span>
            <span class="value">{{ attachment.lastService }}</span>
          </div>
        </div>
        <button @click="attachmentsStore.setCurrentAttachment(attachment)" class="select-btn">
          {{ attachmentsStore.currentAttachment?.id === attachment.id ? 'Current' : 'Select' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/mixins' as *;

.attachments-view {
  padding: var(--spacing-xl);
}

.page-header {
  margin-bottom: var(--spacing-xl);

  h1 {
    font-size: var(--font-size-2xl);
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: var(--spacing-xs);
  }
}

.subtitle {
  color: var(--text-secondary);
}

.attachments-grid {
  @include auto-grid(280px);
}

.attachment-card {
  @include card;
  transition: all 0.2s;

  &:hover {
    transform: translateY(-2px);
  }

  &.active {
    border: 2px solid var(--primary-green);
  }

  &.maintenance {
    opacity: 0.7;
  }

  h3 {
    font-size: var(--font-size-lg);
    margin-bottom: var(--spacing-xs);
  }
}

.attachment-header {
  @include flex-between;
  margin-bottom: var(--spacing-md);

  .material-icons {
    font-size: 32px;
    color: var(--primary-green);
  }
}

.status-badge {
  @include status-badge(var(--status-info));
  text-transform: capitalize;

  &.available {
    background: var(--status-success);
  }

  &.active {
    background: var(--status-info);
  }

  &.maintenance {
    background: var(--status-warning);
  }
}

.type {
  color: var(--text-secondary);
  margin-bottom: var(--spacing-lg);
}

.stats {
  margin-bottom: var(--spacing-lg);
}

.stat {
  @include flex-between;
  padding: var(--spacing-sm) 0;
  border-bottom: 1px solid var(--border-color);

  .label {
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
  }

  .value {
    font-weight: 600;
  }
}

.select-btn {
  @include btn-primary;
  width: 100%;
}

.attachment-card.active .select-btn {
  background: var(--primary-green-light);
  cursor: default;

  &:hover {
    transform: none;
  }
}
</style>
