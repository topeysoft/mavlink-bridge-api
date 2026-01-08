<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import ZoneStatsHeader from '@/components/zones/ZoneStatsHeader.vue';
import ZonesToolbar from '@/components/zones/ZonesToolbar.vue';
import ZoneCard from '@/components/zones/ZoneCard.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import SkeletonCard from '@/components/common/SkeletonCard.vue';
import { useZonesStore } from '@/stores/zones';
import { useNotifications } from '@/composables/useNotifications';
import { useDialog } from '@/composables/useDialog';
import { formatDistance } from 'date-fns';

const router = useRouter();
const { success, error, info } = useNotifications();
const dialog = useDialog();
const zonesStore = useZonesStore();

const searchQuery = ref('');
const filterType = ref('all');

// Use store data
const zones = computed(() => zonesStore.zones);
const loading = computed(() => zonesStore.isLoading);

const filteredZones = computed(() => {
  let filtered = zones.value;

  if (searchQuery.value) {
    filtered = filtered.filter(
      (zone) =>
        zone.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        zone.description
          ?.toLowerCase()
          .includes(searchQuery.value.toLowerCase()) ||
        zone.tags?.some((tag) =>
          tag.toLowerCase().includes(searchQuery.value.toLowerCase()),
        ),
    );
  }

  if (filterType.value !== 'all') {
    filtered = filtered.filter((zone) => zone.type === filterType.value);
  }

  return filtered;
});

const totalArea = computed(() => {
  return zones.value.reduce((sum, zone) => sum + zone.area, 0);
});

const activeZones = computed(() => {
  return zones.value.length;
});

const handleCreateZone = () => {
  router.push('/zones/edit');
};

const handleImport = async () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e: any) => {
    const file = e.target?.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event: any) => {
      try {
        const importedZones = JSON.parse(event.target.result);
        if (Array.isArray(importedZones)) {
          const confirmed = await dialog.confirm(
            `Import ${importedZones.length} zones? This will add to your existing zones.`,
            'Confirm Import',
          );
          if (confirmed) {
            importedZones.forEach((zone) => {
              zonesStore.addZone(zone);
            });
            success(`${importedZones.length} zones imported successfully`);
          }
        } else {
          error('Invalid zone file format');
        }
      } catch (err) {
        error('Error importing zones: ' + (err as Error).message);
      }
    };
    reader.readAsText(file);
  };
  input.click();
};

const handleExport = () => {
  const dataStr = JSON.stringify(zones.value, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `yardrover-zones-${
    new Date().toISOString().split('T')[0]
  }.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  success('Zones exported successfully');
};

const handleSearch = (query: string) => {
  searchQuery.value = query;
};

const handleFilterType = (type: string) => {
  filterType.value = type;
};

const handleEditZone = (id: string) => {
  router.push(`/zones/edit/${id}`);
};

const handleDeleteZone = async (id: string) => {
  const zone = zonesStore.getZoneById(id);
  if (!zone) return;

  const confirmed = await dialog.confirm(
    `Are you sure you want to delete zone "${zone.name}"? This action cannot be undone.`,
    'Confirm Delete',
  );
  if (confirmed) {
    zonesStore.deleteZone(id);
    info(`Zone "${zone.name}" deleted`);
  }
};

const handleToggleStatus = (id: string) => {
  // This could be implemented if zones have an active/inactive status
  console.log('Toggle status:', id);
};

// Format relative time for display
const formatRelativeTime = (timestamp: string) => {
  return formatDistance(new Date(timestamp), new Date(), { addSuffix: true });
};
</script>

<template>
  <div class="zones-view">
    <ZoneStatsHeader
      :total-zones="zones.length"
      :total-area="totalArea"
      :active-zones="activeZones"
    />

    <ZonesToolbar
      @create-zone="handleCreateZone"
      @import="handleImport"
      @export="handleExport"
      @search="handleSearch"
      @filter-type="handleFilterType"
    />

    <!-- Zones Grid with Skeleton Loaders -->
    <div v-if="loading" class="zones-grid">
      <SkeletonCard v-for="i in 3" :key="i" variant="default" />
    </div>

    <div v-else-if="filteredZones.length > 0" class="zones-grid">
      <ZoneCard
        v-for="zone in filteredZones"
        :key="zone.id"
        :zone="zone"
        @edit="handleEditZone"
        @delete="handleDeleteZone"
        @toggle-status="handleToggleStatus"
      />
    </div>

    <EmptyState
      v-else
      icon="map"
      title="No Zones Created Yet"
      message="Create your first coverage zone to start planning missions"
      action-label="Create Zone"
      @action="handleCreateZone"
    />
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/mixins' as *;

.zones-view {
  padding: var(--spacing-xl);
}

.zones-grid {
  @include auto-grid(350px);
  gap: var(--spacing-lg);
}
</style>
