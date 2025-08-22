import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useMAVLinkClient } from '../composables/useMAVLinkClient'
import { createAsyncState, setAsyncLoading, setAsyncData, setAsyncError, createStoreError } from './types'

export interface TaskMetadata {
  id: string
  name: string
  description?: string
  status: 'pending' | 'active' | 'running' | 'paused' | 'completed' | 'failed'
  createdAt: number
  updatedAt: number
}

export interface TaskExecutionStatus {
  taskId: string
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed'
  currentStep: number
  totalSteps: number
  progress: number
  message?: string
}

export interface TaskCreateRequest {
  name: string
  description?: string
  type: string
  parameters?: Record<string, unknown>
}

export interface TaskExecutionRequest {
  parameters?: Record<string, unknown>
}

export const useTaskStore = defineStore('tasks', () => {
  // State
  const tasks = ref(createAsyncState<TaskMetadata[]>())
  const activeTask = ref<string | null>(null)
  const executionStatus = ref(createAsyncState<TaskExecutionStatus>())
  const templates = ref(createAsyncState<unknown[]>())
  const isExecuting = ref(false)
  const queueRunning = ref(false)
  const taskHistory = ref<TaskMetadata[]>([])
  const queueSettings = ref({
    autoStart: false,
    continueOnError: true,
    delayBetweenTasks: 30,
    batteryThreshold: 30
  })

  // Getters (computed)
  const activeTasks = computed(() =>
    tasks.value.data?.filter(t => t.status === 'active') || []
  )

  const completedTasks = computed(() =>
    tasks.value.data?.filter(t => t.status === 'completed') || []
  )

  const failedTasks = computed(() =>
    tasks.value.data?.filter(t => t.status === 'failed') || []
  )

  const pendingTasks = computed(() =>
    tasks.value.data?.filter(t => t.status === 'pending') || []
  )

  const queuedTasks = computed(() =>
    tasks.value.data?.filter(t => ['pending', 'running', 'paused'].includes(t.status)) || []
  )

  const currentTask = computed(() =>
    tasks.value.data?.find(t => t.id === activeTask.value)
  )

  const taskCount = computed(() => tasks.value.data?.length || 0)

  const getTaskById = computed(() => (id: string): TaskMetadata | undefined => {
    return tasks.value.data?.find(t => t.id === id)
  })

  const hasActiveTasks = computed(() =>
    tasks.value.data?.some(t => ['active', 'running', 'paused'].includes(t.status)) || false
  )

  const executionProgress = computed(() => {
    if (!executionStatus.value.data) return 0
    const status = executionStatus.value.data
    if (status.totalSteps && status.totalSteps > 0) {
      return Math.round((status.currentStep / status.totalSteps) * 100)
    }
    return 0
  })

  // Actions
  function fetchTasks () {
    const { client } = useMAVLinkClient()
    if (!client.value) throw new Error('Client not connected')

    setAsyncLoading(tasks.value)

    try {
      // Mock task data since client doesn't have tasks endpoint yet
      const mockTasks: TaskMetadata[] = [
        {
          id: '1',
          name: 'Test Task 1',
          description: 'A test task',
          status: 'pending',
          createdAt: Date.now() - 3600000,
          updatedAt: Date.now()
        },
        {
          id: '2',
          name: 'Test Task 2',
          description: 'Another test task',
          status: 'completed',
          createdAt: Date.now() - 7200000,
          updatedAt: Date.now() - 1800000
        }
      ]
      setAsyncData(tasks.value, mockTasks)
    } catch (error) {
      const storeError = createStoreError(
        'TASK_FETCH_ERROR',
        error instanceof Error ? error.message : 'Failed to fetch tasks',
        error
      )
      setAsyncError(tasks.value, storeError)
      throw error
    }
  }

  function createTask (request: TaskCreateRequest): TaskMetadata {
    const { client } = useMAVLinkClient()
    if (!client.value) throw new Error('Client not connected')

    try {
      // Mock task creation
      const newTask: TaskMetadata = {
        id: Date.now().toString(),
        name: request.name,
        description: request.description || '',
        status: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      // Add to local state
      if (tasks.value.data) {
        tasks.value.data.push(newTask)
        tasks.value.lastUpdated = Date.now()
      }

      return newTask
    } catch (error) {
      throw new Error(`Failed to create task: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  function executeTask (taskId: string) {
    const { client } = useMAVLinkClient()
    if (!client.value) throw new Error('Client not connected')

    isExecuting.value = true

    try {
      // Mock task execution
      activeTask.value = taskId
      const mockStatus: TaskExecutionStatus = {
        taskId,
        status: 'running',
        currentStep: 1,
        totalSteps: 5,
        progress: 20,
        message: 'Task started'
      }
      setAsyncData(executionStatus.value, mockStatus)
    } catch (error) {
      const storeError = createStoreError(
        'TASK_EXECUTE_ERROR',
        error instanceof Error ? error.message : `Failed to execute task ${taskId}`,
        error
      )
      setAsyncError(executionStatus.value, storeError)
      throw error
    } finally {
      isExecuting.value = false
    }
  }

  function pauseTask (taskId: string) {
    const { client } = useMAVLinkClient()
    if (!client.value) throw new Error('Client not connected')

    // Mock pause
    if (executionStatus.value.data && executionStatus.value.data.taskId === taskId) {
      executionStatus.value.data.status = 'paused'
      executionStatus.value.lastUpdated = Date.now()
    }
  }

  function resumeTask (taskId: string) {
    const { client } = useMAVLinkClient()
    if (!client.value) throw new Error('Client not connected')

    // Mock resume
    if (executionStatus.value.data && executionStatus.value.data.taskId === taskId) {
      executionStatus.value.data.status = 'running'
      executionStatus.value.lastUpdated = Date.now()
    }
  }

  function stopTask (taskId: string) {
    const { client } = useMAVLinkClient()
    if (!client.value) throw new Error('Client not connected')

    // Mock stop
    if (activeTask.value === taskId) {
      activeTask.value = null
    }

    // Update task in list
    const task = tasks.value.data?.find(t => t.id === taskId)
    if (task) {
      task.status = 'failed'
      tasks.value.lastUpdated = Date.now()
    }
  }

  function deleteTask (taskId: string) {
    const { client } = useMAVLinkClient()
    if (!client.value) throw new Error('Client not connected')

    if (activeTask.value === taskId) {
      activeTask.value = null
    }

    // Remove from local state
    if (tasks.value.data) {
      tasks.value.data = tasks.value.data.filter(t => t.id !== taskId)
      tasks.value.lastUpdated = Date.now()
    }
  }

  function fetchExecutionStatus (taskId: string) {
    const { client } = useMAVLinkClient()
    if (!client.value) throw new Error('Client not connected')

    setAsyncLoading(executionStatus.value)

    try {
      // Mock status fetch
      const mockStatus: TaskExecutionStatus = {
        taskId,
        status: 'running',
        currentStep: 3,
        totalSteps: 5,
        progress: 60,
        message: 'Processing step 3'
      }
      setAsyncData(executionStatus.value, mockStatus)
    } catch (error) {
      const storeError = createStoreError(
        'TASK_STATUS_ERROR',
        error instanceof Error ? error.message : `Failed to get execution status for task ${taskId}`,
        error
      )
      setAsyncError(executionStatus.value, storeError)
      throw error
    }
  }

  function fetchTemplates () {
    const { client } = useMAVLinkClient()
    if (!client.value) throw new Error('Client not connected')

    setAsyncLoading(templates.value)

    try {
      // Mock templates
      const mockTemplates = [
        { id: '1', name: 'Basic Task Template', type: 'basic' },
        { id: '2', name: 'Advanced Task Template', type: 'advanced' }
      ]
      setAsyncData(templates.value, mockTemplates)
    } catch (error) {
      const storeError = createStoreError(
        'TEMPLATE_FETCH_ERROR',
        error instanceof Error ? error.message : 'Failed to fetch task templates',
        error
      )
      setAsyncError(templates.value, storeError)
      throw error
    }
  }

  function handleTaskUpdate (update: TaskExecutionStatus) {
    if (update.taskId === activeTask.value) {
      setAsyncData(executionStatus.value, update)
    }

    // Update task status in list
    const task = tasks.value.data?.find(t => t.id === update.taskId)
    if (task) {
      task.status = update.status
      tasks.value.lastUpdated = Date.now()
    }
  }

  function handleTaskCompleted (taskId: string) {
    if (activeTask.value === taskId) {
      activeTask.value = null
    }

    // Refresh tasks to get final status
    void fetchTasks()
  }

  function setupWebSocketHandlers () {
    const { client } = useMAVLinkClient()
    if (!client.value) return

    // WebSocket handlers would be set up here when available
  }

  function setActiveTask (taskId: string | null) {
    activeTask.value = taskId
  }

  function clearExecutionStatus () {
    executionStatus.value.data = null
    executionStatus.value.error = null
  }

  function clearErrors () {
    tasks.value.error = null
    executionStatus.value.error = null
    templates.value.error = null
  }

  async function refreshData () {
    try {
      await Promise.all([
        fetchTasks(),
        fetchTemplates()
      ])
    } catch (error) {
      console.error('Failed to refresh task data:', error)
      throw error
    }
  }

  // Queue Management Methods
  function startQueue() {
    const { client } = useMAVLinkClient()
    if (!client.value) throw new Error('Client not connected')
    
    queueRunning.value = true
    // Would call client.value.tasks.startQueue() when available
  }

  function stopQueue() {
    const { client } = useMAVLinkClient()
    if (!client.value) throw new Error('Client not connected')
    
    queueRunning.value = false
    // Would call client.value.tasks.stopQueue() when available
  }

  function removeFromQueue(taskId: string) {
    const { client } = useMAVLinkClient()
    if (!client.value) throw new Error('Client not connected')
    
    // Remove from local state
    if (tasks.value.data) {
      const taskIndex = tasks.value.data.findIndex(t => t.id === taskId)
      if (taskIndex > -1) {
        tasks.value.data.splice(taskIndex, 1)
        tasks.value.lastUpdated = Date.now()
      }
    }
    // Would call client.value.tasks.removeFromQueue(taskId) when available
  }

  function reorderQueue(from: number, to: number) {
    // Reorder tasks in queue
    const queueTasks = queuedTasks.value
    if (from >= 0 && to >= 0 && from < queueTasks.length && to < queueTasks.length) {
      const allTasks = [...(tasks.value.data || [])]
      const fromTaskId = queueTasks[from]?.id
      const toTaskId = queueTasks[to]?.id
      
      const fromIndex = allTasks.findIndex(t => t.id === fromTaskId)
      const toIndex = allTasks.findIndex(t => t.id === toTaskId)
      
      if (fromIndex > -1 && toIndex > -1) {
        const item = allTasks.splice(fromIndex, 1)[0]
        if (item) {
          allTasks.splice(toIndex, 0, item)
          tasks.value.data = allTasks
          tasks.value.lastUpdated = Date.now()
        }
      }
    }
  }

  function createTaskFromTemplate(template: TaskMetadata & { parameters?: Record<string, unknown>; type?: string }) {
    const taskData: TaskCreateRequest = {
      name: `${template.name} (Copy)`,
      description: template.description || '',
      type: template.type || 'custom',
      parameters: template.parameters || {}
    }
    
    return createTask(taskData)
  }

  function deleteFromHistory(taskId: string) {
    // Remove task from history
    const index = taskHistory.value.findIndex(t => t.id === taskId)
    if (index > -1) {
      taskHistory.value.splice(index, 1)
    }
  }

  return {
    // State
    tasks,
    activeTask,
    executionStatus,
    templates,
    isExecuting,
    queueRunning,
    taskHistory,
    queueSettings,

    // Getters
    activeTasks,
    completedTasks,
    failedTasks,
    pendingTasks,
    queuedTasks,
    currentTask,
    taskCount,
    getTaskById,
    hasActiveTasks,
    executionProgress,

    // Actions
    fetchTasks,
    createTask,
    executeTask,
    pauseTask,
    resumeTask,
    stopTask,
    deleteTask,
    fetchExecutionStatus,
    fetchTemplates,
    handleTaskUpdate,
    handleTaskCompleted,
    setupWebSocketHandlers,
    setActiveTask,
    clearExecutionStatus,
    clearErrors,
    refreshData,
    
    // Queue Management
    startQueue,
    stopQueue,
    removeFromQueue,
    reorderQueue,
    createTaskFromTemplate,
    deleteFromHistory
  }
})
