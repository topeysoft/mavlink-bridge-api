<template>
  <div>
    <div class="row items-center q-mb-md">
      <div class="col">
        <div class="text-subtitle1">Connection Profiles</div>
        <div class="text-caption text-grey-6">Save and manage frequently used RTCM connections</div>
      </div>
      <div class="col-auto">
        <q-btn
          label="Import"
          flat
          icon="mdi-import"
          @click="importProfiles"
          class="q-mr-sm"
        />
        <q-btn
          label="Export"
          flat
          icon="mdi-export"
          @click="exportProfiles"
          :disable="profiles.length === 0"
        />
      </div>
    </div>

    <div v-if="profiles.length === 0" class="text-center q-py-lg text-grey-6">
      <q-icon name="mdi-folder-open" size="64px" color="grey-4" />
      <div class="q-mt-md">No saved profiles</div>
      <div class="text-caption">Save your current connection as a profile for quick access</div>
    </div>

    <q-list v-else separator>
      <q-item v-for="profile in profiles" :key="profile.id" class="profile-item">
        <q-item-section avatar>
          <q-icon :name="getProfileIcon(profile.config.source.type)" color="primary" />
        </q-item-section>

        <q-item-section>
          <q-item-label>
            {{ profile.name }}
            <q-chip 
              v-if="profile.id === activeProfileId" 
              color="positive" 
              text-color="white" 
              size="sm"
              dense
            >
              Active
            </q-chip>
          </q-item-label>
          <q-item-label caption>
            {{ getProfileSummary(profile) }}
          </q-item-label>
          <q-item-label caption v-if="profile.description">
            {{ profile.description }}
          </q-item-label>
          <q-item-label caption class="text-grey-6">
            Created: {{ formatDate(profile.createdAt) }}
            <span v-if="profile.lastUsed">
              | Last used: {{ formatDate(profile.lastUsed) }}
            </span>
          </q-item-label>
        </q-item-section>

        <q-item-section side>
          <div class="text-grey-8 q-gutter-xs">
            <q-btn
              size="sm"
              flat
              dense
              icon="mdi-play"
              @click="connectProfile(profile)"
              :disable="isActive"
            >
              <q-tooltip>Connect using this profile</q-tooltip>
            </q-btn>
            <q-btn
              size="sm"
              flat
              dense
              icon="mdi-pencil"
              @click="editProfile(profile)"
            >
              <q-tooltip>Edit profile</q-tooltip>
            </q-btn>
            <q-btn
              size="sm"
              flat
              dense
              icon="mdi-delete"
              @click="confirmDeleteProfile(profile)"
            >
              <q-tooltip>Delete profile</q-tooltip>
            </q-btn>
          </div>
        </q-item-section>
      </q-item>
    </q-list>

    <!-- Edit Profile Dialog -->
    <q-dialog v-model="showEditDialog">
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">Edit Profile</div>
        </q-card-section>

        <q-card-section>
          <q-input
            v-model="editingProfile.name"
            label="Profile Name"
            autofocus
          />
          <q-input
            v-model="editingProfile.description"
            label="Description"
            type="textarea"
            rows="2"
            class="q-mt-md"
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="primary" v-close-popup />
          <q-btn 
            flat 
            label="Save" 
            color="primary" 
            @click="saveEditedProfile"
            :disable="!editingProfile.name"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Delete Confirmation Dialog -->
    <q-dialog v-model="showDeleteDialog">
      <q-card>
        <q-card-section>
          <div class="text-h6">Delete Profile</div>
        </q-card-section>

        <q-card-section>
          Are you sure you want to delete the profile "{{ profileToDelete?.name }}"?
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="primary" v-close-popup />
          <q-btn 
            flat 
            label="Delete" 
            color="negative" 
            @click="deleteSelectedProfile"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Import file input (hidden) -->
    <input
      ref="fileInput"
      type="file"
      accept=".json"
      style="display: none"
      @change="handleFileImport"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useQuasar } from 'quasar'
import { useRTCM } from '../../composables/useRTCM'
import type { RTCMProfile } from '../../stores/rtcm'

const $q = useQuasar()
const {
  profiles,
  activeProfileId,
  isActive,
  applyProfile,
  updateProfile,
  deleteProfile
} = useRTCM()

const showEditDialog = ref(false)
const showDeleteDialog = ref(false)
const editingProfile = ref<{id?: string, name: string, description: string}>({name: '', description: ''})
const profileToDelete = ref<RTCMProfile | null>(null)
const fileInput = ref<HTMLInputElement>()

function getProfileIcon(sourceType: string): string {
  switch (sourceType) {
    case 'ntrip': return 'mdi-earth'
    case 'tcp': return 'mdi-ethernet'
    case 'udp': return 'mdi-access-point'
    default: return 'mdi-satellite-variant'
  }
}

function getProfileSummary(profile: RTCMProfile): string {
  const source = profile.config.source
  switch (source.type) {
    case 'ntrip':
      return `NTRIP: ${source.host}:${source.port}/${source.mountpoint}`
    case 'tcp':
      return `TCP: ${source.host}:${source.port}`
    case 'udp':
      return `UDP: Port ${source.port}`
    default:
      return source.type
  }
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

async function connectProfile(profile: RTCMProfile) {
  try {
    await applyProfile(profile.id)
    $q.notify({
      type: 'positive',
      message: `Connected using profile "${profile.name}"`,
      position: 'top'
    })
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'Failed to connect using profile',
      caption: error instanceof Error ? error.message : String(error),
      position: 'top'
    })
  }
}

function editProfile(profile: RTCMProfile) {
  editingProfile.value = {
    id: profile.id,
    name: profile.name,
    description: profile.description || ''
  }
  showEditDialog.value = true
}

function saveEditedProfile() {
  if (editingProfile.value.id) {
    updateProfile(editingProfile.value.id, {
      name: editingProfile.value.name,
      description: editingProfile.value.description
    })
  }
  
  $q.notify({
    type: 'positive',
    message: 'Profile updated',
    position: 'top'
  })
  
  showEditDialog.value = false
}

function confirmDeleteProfile(profile: RTCMProfile) {
  profileToDelete.value = profile
  showDeleteDialog.value = true
}

function deleteSelectedProfile() {
  if (profileToDelete.value) {
    deleteProfile(profileToDelete.value.id)
    
    $q.notify({
      type: 'positive',
      message: 'Profile deleted',
      position: 'top'
    })
  }
  
  showDeleteDialog.value = false
  profileToDelete.value = null
}

function exportProfiles() {
  const data = profiles.value
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `rtcm-profiles-${Date.now()}.json`
  link.click()
  URL.revokeObjectURL(url)
  
  $q.notify({
    type: 'positive',
    message: 'Profiles exported',
    position: 'top'
  })
}

function importProfiles() {
  fileInput.value?.click()
}

async function handleFileImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  
  try {
    const text = await file.text()
    const importedProfiles = JSON.parse(text) as RTCMProfile[]
    
    // Validate the imported data
    if (!Array.isArray(importedProfiles)) {
      throw new Error('Invalid profile data')
    }
    
    // Add imported profiles (with new IDs to avoid conflicts)
    let importCount = 0
    for (const profile of importedProfiles) {
      if (profile.name && profile.config && profile.config.source) {
        // Generate new ID
        const newProfile = {
          ...profile,
          id: Date.now().toString(36) + Math.random().toString(36).substr(2),
          createdAt: Date.now()
        }
        profiles.value.push(newProfile)
        importCount++
      }
    }
    
    // Save to storage (this would be handled by the store)
    localStorage.setItem('rtcm-profiles', JSON.stringify(profiles.value))
    
    $q.notify({
      type: 'positive',
      message: `Imported ${importCount} profiles`,
      position: 'top'
    })
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'Failed to import profiles',
      caption: error instanceof Error ? error.message : 'Invalid file format',
      position: 'top'
    })
  }
  
  // Reset file input
  input.value = ''
}
</script>

<style scoped>
.profile-item {
  transition: background-color 0.3s;
}

.profile-item:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

.q-dark .profile-item:hover {
  background-color: rgba(255, 255, 255, 0.04);
}
</style>