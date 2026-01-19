import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import { useConnectionStore } from './connection'
import { useFeaturesStore } from './features'
import type {
  MissionTemplateClient,
  MissionTemplateSummary,
  MissionTemplateDetail,
  TemplateCategoryInfo,
  TemplateCategory,
  WeatherCheckResponse,
  MissionFromTemplateRequest,
  UserMode
} from '@client'

export const useMissionTemplatesStore = defineStore('missionTemplates', () => {
  const connectionStore = useConnectionStore()
  const featuresStore = useFeaturesStore()

  // State
  const templates = ref<MissionTemplateSummary[]>([])
  const categories = ref<TemplateCategoryInfo[]>([])
  const templateDetails = ref<Map<string, MissionTemplateDetail>>(new Map())
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const selectedCategory = ref<TemplateCategory | null>(null)

  // Get template client from connection store
  const templateClient = computed(() => connectionStore.client?.templates as MissionTemplateClient | undefined)

  // Get user mode for filtering
  const userMode = computed((): UserMode => {
    const mode = featuresStore.userMode
    if (mode === 'consumer') return 'consumer'
    if (mode === 'power-user') return 'power-user'
    return 'developer'
  })

  // Watch for connection and load templates
  watch(() => connectionStore.isConnected, async (connected) => {
    if (connected && templateClient.value) {
      await loadTemplates()
    } else {
      templates.value = []
      categories.value = []
      templateDetails.value.clear()
    }
  }, { immediate: true })

  // Computed getters
  const availableTemplates = computed(() =>
    templates.value.filter(t => t.available)
  )

  const unavailableTemplates = computed(() =>
    templates.value.filter(t => !t.available)
  )

  const templatesByCategory = computed(() => {
    const grouped: Record<string, MissionTemplateSummary[]> = {}
    for (const template of templates.value) {
      if (!grouped[template.category]) {
        grouped[template.category] = []
      }
      grouped[template.category].push(template)
    }
    return grouped
  })

  const filteredTemplates = computed(() => {
    if (!selectedCategory.value) {
      return templates.value
    }
    return templates.value.filter(t => t.category === selectedCategory.value)
  })

  const availableFilteredTemplates = computed(() =>
    filteredTemplates.value.filter(t => t.available)
  )

  // Actions
  async function loadTemplates(includeUnavailable = true) {
    if (!templateClient.value) {
      error.value = 'Template client not available'
      return
    }

    isLoading.value = true
    error.value = null

    try {
      const response = await templateClient.value.listTemplates({
        userMode: userMode.value,
        includeUnavailable
      })
      templates.value = response.templates
      categories.value = response.categories
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load templates'
      console.error('Failed to load templates:', err)
    } finally {
      isLoading.value = false
    }
  }

  async function loadTemplatesByCategory(category: TemplateCategory) {
    if (!templateClient.value) {
      error.value = 'Template client not available'
      return
    }

    isLoading.value = true
    error.value = null

    try {
      const response = await templateClient.value.listTemplates({
        category,
        userMode: userMode.value,
        includeUnavailable: true
      })
      // Update templates for this category
      const otherTemplates = templates.value.filter(t => t.category !== category)
      templates.value = [...otherTemplates, ...response.templates]
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load templates'
      console.error('Failed to load templates:', err)
    } finally {
      isLoading.value = false
    }
  }

  async function getTemplateDetails(templateId: string): Promise<MissionTemplateDetail | null> {
    // Check cache first
    if (templateDetails.value.has(templateId)) {
      return templateDetails.value.get(templateId)!
    }

    if (!templateClient.value) {
      error.value = 'Template client not available'
      return null
    }

    try {
      const detail = await templateClient.value.getTemplate(templateId)
      templateDetails.value.set(templateId, detail)
      return detail
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to get template details'
      console.error('Failed to get template details:', err)
      return null
    }
  }

  async function checkWeatherForTemplate(
    templateId: string,
    scheduledTime?: Date
  ): Promise<WeatherCheckResponse | null> {
    if (!templateClient.value) {
      error.value = 'Template client not available'
      return null
    }

    try {
      return await templateClient.value.checkWeather(templateId, scheduledTime)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to check weather'
      console.error('Failed to check weather:', err)
      return null
    }
  }

  async function createMissionFromTemplate(
    templateId: string,
    request: MissionFromTemplateRequest
  ): Promise<string | null> {
    if (!templateClient.value) {
      error.value = 'Template client not available'
      return null
    }

    isLoading.value = true
    error.value = null

    try {
      const response = await templateClient.value.createMissionFromTemplate(templateId, request)
      return response.id
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create mission'
      console.error('Failed to create mission from template:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // Helper methods
  function getTemplateById(id: string): MissionTemplateSummary | undefined {
    return templates.value.find(t => t.id === id)
  }

  function getTemplateName(template: MissionTemplateSummary): string {
    return userMode.value === 'consumer' ? template.consumer_name : template.name
  }

  function getTemplateDescription(template: MissionTemplateSummary): string {
    return userMode.value === 'consumer' ? template.consumer_description : template.description
  }

  function getCategoryName(category: TemplateCategoryInfo): string {
    return userMode.value === 'consumer' ? category.consumer_name : category.name
  }

  function setSelectedCategory(category: TemplateCategory | null) {
    selectedCategory.value = category
  }

  function clearCache() {
    templateDetails.value.clear()
  }

  async function refreshTemplates() {
    clearCache()
    await loadTemplates()
  }

  return {
    // State
    templates,
    categories,
    isLoading,
    error,
    selectedCategory,

    // Computed
    availableTemplates,
    unavailableTemplates,
    templatesByCategory,
    filteredTemplates,
    availableFilteredTemplates,
    userMode,

    // Actions
    loadTemplates,
    loadTemplatesByCategory,
    getTemplateDetails,
    checkWeatherForTemplate,
    createMissionFromTemplate,

    // Helpers
    getTemplateById,
    getTemplateName,
    getTemplateDescription,
    getCategoryName,
    setSelectedCategory,
    clearCache,
    refreshTemplates
  }
})
