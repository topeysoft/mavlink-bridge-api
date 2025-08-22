<template>
  <q-page :padding="!noPadding" class="base-page">
    <!-- Page Header -->
    <div v-if="title || $slots.header" class="page-header q-mb-lg">
      <div class="row items-center">
        <div class="col">
          <h1 class="text-h4 text-weight-bold q-ma-none">{{ title }}</h1>
          <p v-if="subtitle" class="text-subtitle1 text-grey-7 q-ma-none">
            {{ subtitle }}
          </p>
        </div>
        <div v-if="$slots.actions" class="col-auto">
          <slot name="actions" />
        </div>
      </div>
      <slot name="header" />
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="row justify-center q-py-xl">
      <q-spinner-dots color="primary" size="50px" />
    </div>

    <!-- Error State -->
    <q-banner v-else-if="error" class="text-negative q-mb-md" rounded>
      <template v-slot:avatar>
        <q-icon name="error" />
      </template>
      {{ error.message }}
      <template v-slot:action>
        <q-btn flat label="Retry" @click="$emit('retry')" />
      </template>
    </q-banner>

    <!-- Page Content -->
    <div v-else class="page-content">
      <slot />
    </div>
  </q-page>
</template>

<script setup lang="ts">
interface Props {
  title?: string;
  subtitle?: string;
  loading?: boolean;
  error?: { message: string } | null;
  noPadding?: boolean;
}

defineProps<Props>();
defineEmits<{
  retry: [];
}>();
</script>

<style lang="scss" scoped>
.base-page {
  max-width: 1400px;
  margin: 0 auto;
  overflow-y: auto;
  height: 100%;
  max-height: 100vh;
}

.page-header {
  border-bottom: 1px solid $grey-3;
  padding-bottom: 16px;

  .body--dark & {
    border-color: $grey-8;
  }
}

@media (max-width: 599px) {
  .page-header h1 {
    font-size: 1.5rem;
  }
}
</style>
