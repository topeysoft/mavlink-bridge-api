<template>
  <div class="app-layout">
    <Sidebar />
    <div class="app-main">
      <Header />
      <main class="app-content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import Sidebar from '@/components/common/Sidebar.vue'
import Header from '@/components/common/Header.vue'
</script>

<style scoped lang="scss">
.app-layout {
  display: flex;
  min-height: 100vh;
  background: var(--bg-primary);
}

.app-main {
  flex: 1;
  margin-left: var(--sidebar-width);
  display: flex;
  flex-direction: column;
  transition: margin-left 0.3s ease;
}

// Adjust for collapsed sidebar
:global(.sidebar.collapsed) ~ .app-main {
  margin-left: var(--sidebar-collapsed-width);
}

.app-content {
  flex: 1;
  overflow-y: auto;
}

// Mobile responsive
@media (max-width: 768px) {
  .app-main {
    margin-left: 0;
  }
}
</style>
