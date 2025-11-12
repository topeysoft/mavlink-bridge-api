import { ref, computed, watch, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import type { User } from '@/stores/types'

export interface Permission {
  id: string
  name: string
  description: string
  resource: string
  action: string
  conditions?: Record<string, any>
}

export interface Role {
  id: string
  name: string
  level: number
  permissions: Permission[]
  description: string
}

export interface PermissionCheck {
  allowed: boolean
  reason?: string
  conditions?: Record<string, any>
}

export function usePermissions() {
  const authStore = useAuthStore()
  const { user, isAuthenticated } = storeToRefs(authStore)
  
  // Permission definitions
  const permissions = ref<Permission[]>([
    // Machine permissions
    { id: 'machine.view', name: 'View Machines', description: 'View machine status and information', resource: 'machine', action: 'read' },
    { id: 'machine.start', name: 'Start Machine', description: 'Start machine operations', resource: 'machine', action: 'start' },
    { id: 'machine.stop', name: 'Stop Machine', description: 'Stop machine operations', resource: 'machine', action: 'stop' },
    { id: 'machine.pause', name: 'Pause Machine', description: 'Pause machine operations', resource: 'machine', action: 'pause' },
    { id: 'machine.emergency_stop', name: 'Emergency Stop', description: 'Emergency stop machine', resource: 'machine', action: 'emergency_stop' },
    { id: 'machine.configure', name: 'Configure Machine', description: 'Modify machine settings', resource: 'machine', action: 'configure' },
    { id: 'machine.maintenance', name: 'Machine Maintenance', description: 'Perform maintenance operations', resource: 'machine', action: 'maintenance' },
    
    // Task permissions
    { id: 'task.view', name: 'View Tasks', description: 'View task information', resource: 'task', action: 'read' },
    { id: 'task.create', name: 'Create Tasks', description: 'Create new tasks', resource: 'task', action: 'create' },
    { id: 'task.edit', name: 'Edit Tasks', description: 'Modify existing tasks', resource: 'task', action: 'update' },
    { id: 'task.delete', name: 'Delete Tasks', description: 'Delete tasks', resource: 'task', action: 'delete' },
    { id: 'task.execute', name: 'Execute Tasks', description: 'Start task execution', resource: 'task', action: 'execute' },
    { id: 'task.schedule', name: 'Schedule Tasks', description: 'Schedule automatic tasks', resource: 'task', action: 'schedule' },
    
    // Yard permissions
    { id: 'yard.view', name: 'View Yards', description: 'View yard information', resource: 'yard', action: 'read' },
    { id: 'yard.create', name: 'Create Yards', description: 'Create new yards', resource: 'yard', action: 'create' },
    { id: 'yard.edit', name: 'Edit Yards', description: 'Modify yard settings', resource: 'yard', action: 'update' },
    { id: 'yard.delete', name: 'Delete Yards', description: 'Delete yards', resource: 'yard', action: 'delete' },
    { id: 'yard.zones', name: 'Manage Zones', description: 'Create and edit yard zones', resource: 'yard', action: 'zones' },
    { id: 'yard.obstacles', name: 'Manage Obstacles', description: 'Manage yard obstacles', resource: 'yard', action: 'obstacles' },
    
    // User permissions
    { id: 'user.view', name: 'View Users', description: 'View user information', resource: 'user', action: 'read' },
    { id: 'user.create', name: 'Create Users', description: 'Create new users', resource: 'user', action: 'create' },
    { id: 'user.edit', name: 'Edit Users', description: 'Modify user settings', resource: 'user', action: 'update' },
    { id: 'user.delete', name: 'Delete Users', description: 'Delete users', resource: 'user', action: 'delete' },
    { id: 'user.roles', name: 'Manage Roles', description: 'Assign and manage user roles', resource: 'user', action: 'roles' },
    
    // System permissions
    { id: 'system.admin', name: 'System Administration', description: 'Full system administration', resource: 'system', action: 'admin' },
    { id: 'system.settings', name: 'System Settings', description: 'Modify system settings', resource: 'system', action: 'settings' },
    { id: 'system.logs', name: 'View Logs', description: 'View system logs', resource: 'system', action: 'logs' },
    { id: 'system.backup', name: 'System Backup', description: 'Backup and restore system', resource: 'system', action: 'backup' },
    
    // Weather permissions
    { id: 'weather.view', name: 'View Weather', description: 'View weather information', resource: 'weather', action: 'read' },
    { id: 'weather.configure', name: 'Configure Weather', description: 'Configure weather settings', resource: 'weather', action: 'configure' }
  ])
  
  // Role definitions
  const roles = ref<Role[]>([
    {
      id: 'viewer',
      name: 'Viewer',
      level: 1,
      description: 'Can only view information, no control actions',
      permissions: permissions.value.filter(p => 
        p.action === 'read' || p.id === 'weather.view'
      )
    },
    {
      id: 'operator',
      name: 'Operator',
      level: 2,
      description: 'Can operate machines and manage basic tasks',
      permissions: permissions.value.filter(p => 
        ['read', 'start', 'stop', 'pause', 'execute', 'zones', 'obstacles'].includes(p.action) ||
        p.id === 'task.create' || p.id === 'weather.view'
      )
    },
    {
      id: 'manager',
      name: 'Manager',
      level: 3,
      description: 'Can manage all operations except system administration',
      permissions: permissions.value.filter(p => 
        !['admin', 'backup', 'delete'].includes(p.action) &&
        !p.id.includes('system.') &&
        p.id !== 'user.delete'
      )
    },
    {
      id: 'admin',
      name: 'Administrator',
      level: 4,
      description: 'Full system access',
      permissions: [...permissions.value]
    }
  ])
  
  // Computed properties
  const currentUserRole = computed((): Role | null => {
    if (!user.value?.role) return null
    return roles.value.find(role => role.id === user.value.role) || null
  })
  
  const userPermissions = computed((): Permission[] => {
    if (!currentUserRole.value) return []
    return currentUserRole.value.permissions
  })
  
  const permissionMap = computed((): Map<string, Permission> => {
    const map = new Map()
    userPermissions.value.forEach(permission => {
      map.set(permission.id, permission)
    })
    return map
  })
  
  const isAdmin = computed((): boolean => {
    return currentUserRole.value?.id === 'admin' || false
  })
  
  const isManager = computed((): boolean => {
    return currentUserRole.value?.level >= 3 || false
  })
  
  const isOperator = computed((): boolean => {
    return currentUserRole.value?.level >= 2 || false
  })
  
  const canManageUsers = computed((): boolean => {
    return hasPermission('user.create') || hasPermission('user.edit') || hasPermission('user.roles')
  })
  
  const canManageSystem = computed((): boolean => {
    return hasPermission('system.admin') || hasPermission('system.settings')
  })
  
  // Permission checking methods
  function hasPermission(permissionId: string, context?: Record<string, any>): boolean {
    if (!isAuthenticated.value || !user.value) return false
    
    // Admin bypass
    if (isAdmin.value) return true
    
    const permission = permissionMap.value.get(permissionId)
    if (!permission) return false
    
    // Check conditions if provided
    if (permission.conditions && context) {
      return checkPermissionConditions(permission.conditions, context)
    }
    
    return true
  }
  
  function hasAnyPermission(permissionIds: string[], context?: Record<string, any>): boolean {
    return permissionIds.some(id => hasPermission(id, context))
  }
  
  function hasAllPermissions(permissionIds: string[], context?: Record<string, any>): boolean {
    return permissionIds.every(id => hasPermission(id, context))
  }
  
  function checkPermission(permissionId: string, context?: Record<string, any>): PermissionCheck {
    if (!isAuthenticated.value || !user.value) {
      return { allowed: false, reason: 'Not authenticated' }
    }
    
    if (isAdmin.value) {
      return { allowed: true, reason: 'Administrator access' }
    }
    
    const permission = permissionMap.value.get(permissionId)
    if (!permission) {
      return { allowed: false, reason: 'Permission not found' }
    }
    
    // Check role level for certain operations
    const requiredLevels: Record<string, number> = {
      'machine.emergency_stop': 2,
      'machine.configure': 2,
      'machine.maintenance': 3,
      'task.delete': 3,
      'yard.delete': 3,
      'user.create': 3,
      'user.edit': 3,
      'user.delete': 4,
      'system.admin': 4,
      'system.backup': 4
    }
    
    const requiredLevel = requiredLevels[permissionId]
    if (requiredLevel && (!currentUserRole.value || currentUserRole.value.level < requiredLevel)) {
      return { 
        allowed: false, 
        reason: `Requires ${getRoleName(requiredLevel)} level or higher` 
      }
    }
    
    // Check conditions
    if (permission.conditions && context) {
      const conditionCheck = checkPermissionConditions(permission.conditions, context)
      if (!conditionCheck) {
        return { 
          allowed: false, 
          reason: 'Condition requirements not met',
          conditions: permission.conditions
        }
      }
    }
    
    return { allowed: true }
  }
  
  function checkPermissionConditions(conditions: Record<string, any>, context: Record<string, any>): boolean {
    // Example condition checking logic
    for (const [key, expectedValue] of Object.entries(conditions)) {
      const actualValue = context[key]
      
      if (typeof expectedValue === 'function') {
        if (!expectedValue(actualValue, context)) return false
      } else if (Array.isArray(expectedValue)) {
        if (!expectedValue.includes(actualValue)) return false
      } else {
        if (actualValue !== expectedValue) return false
      }
    }
    
    return true
  }
  
  // Resource-specific permission methods
  function canControlMachine(machineId?: string): PermissionCheck {
    const context = machineId ? { machineId } : undefined
    return checkPermission('machine.start', context)
  }
  
  function canStopMachine(machineId?: string): PermissionCheck {
    const context = machineId ? { machineId } : undefined
    return checkPermission('machine.stop', context)
  }
  
  function canEmergencyStop(machineId?: string): PermissionCheck {
    const context = machineId ? { machineId } : undefined
    return checkPermission('machine.emergency_stop', context)
  }
  
  function canConfigureMachine(machineId?: string): PermissionCheck {
    const context = machineId ? { machineId } : undefined
    return checkPermission('machine.configure', context)
  }
  
  function canCreateTask(taskData?: Record<string, any>): PermissionCheck {
    return checkPermission('task.create', taskData)
  }
  
  function canEditTask(taskId: string, taskData?: Record<string, any>): PermissionCheck {
    const context = { taskId, ...taskData }
    return checkPermission('task.edit', context)
  }
  
  function canDeleteTask(taskId: string): PermissionCheck {
    return checkPermission('task.delete', { taskId })
  }
  
  function canManageYard(yardId?: string): PermissionCheck {
    const context = yardId ? { yardId } : undefined
    return checkPermission('yard.edit', context)
  }
  
  function canViewUserData(userId?: string): PermissionCheck {
    // Users can always view their own data
    if (userId && user.value?.id === userId) {
      return { allowed: true, reason: 'Own data access' }
    }
    
    return checkPermission('user.view', { userId })
  }
  
  // Utility methods
  function getRoleName(level: number): string {
    const role = roles.value.find(r => r.level === level)
    return role?.name || 'Unknown'
  }
  
  function getPermissionsByResource(resource: string): Permission[] {
    return userPermissions.value.filter(p => p.resource === resource)
  }
  
  function getResourceActions(resource: string): string[] {
    return getPermissionsByResource(resource).map(p => p.action)
  }
  
  function hasResourceAccess(resource: string, minActions: string[] = ['read']): boolean {
    const actions = getResourceActions(resource)
    return minActions.every(action => actions.includes(action))
  }
  
  // Permission-based UI helpers
  function shouldShowFeature(featurePermissions: string[]): boolean {
    return hasAnyPermission(featurePermissions)
  }
  
  function getAccessibleRoutes(): string[] {
    const routes: Record<string, string[]> = {
      '/dashboard': ['machine.view', 'task.view', 'yard.view'],
      '/machines': ['machine.view'],
      '/tasks': ['task.view'],
      '/yards': ['yard.view'],
      '/weather': ['weather.view'],
      '/users': ['user.view'],
      '/settings': ['system.settings'],
      '/admin': ['system.admin']
    }
    
    return Object.entries(routes)
      .filter(([route, permissions]) => hasAnyPermission(permissions))
      .map(([route]) => route)
  }
  
  function filterByPermissions<T extends Record<string, any>>(
    items: T[],
    permissionCheck: (item: T) => string
  ): T[] {
    return items.filter(item => hasPermission(permissionCheck(item)))
  }
  
  // Role management (for admins)
  function getUserRole(targetUser: User): Role | null {
    return roles.value.find(role => role.id === targetUser.role) || null
  }
  
  function canAssignRole(targetRole: Role): PermissionCheck {
    if (!hasPermission('user.roles')) {
      return { allowed: false, reason: 'No permission to manage roles' }
    }
    
    // Users can only assign roles lower than or equal to their own
    if (currentUserRole.value && targetRole.level > currentUserRole.value.level) {
      return { allowed: false, reason: 'Cannot assign higher privilege role' }
    }
    
    return { allowed: true }
  }
  
  function getAssignableRoles(): Role[] {
    if (!hasPermission('user.roles')) return []
    
    const currentLevel = currentUserRole.value?.level || 0
    return roles.value.filter(role => role.level <= currentLevel)
  }
  
  // Debug and development helpers
  function debugPermissions(): void {
    console.group('User Permissions Debug')
    console.log('User:', user.value)
    console.log('Role:', currentUserRole.value)
    console.log('Permissions:', userPermissions.value.map(p => p.id))
    console.log('Is Admin:', isAdmin.value)
    console.log('Is Manager:', isManager.value)
    console.log('Is Operator:', isOperator.value)
    console.groupEnd()
  }
  
  function getAllPermissions(): Permission[] {
    return permissions.value
  }
  
  function getAllRoles(): Role[] {
    return roles.value
  }
  
  // Watch for authentication changes
  watch(isAuthenticated, (authenticated) => {
    if (!authenticated) {
      // Clear any cached permission data
      console.log('User logged out, permissions cleared')
    }
  })
  
  return {
    // State
    permissions: computed(() => permissions.value),
    roles: computed(() => roles.value),
    currentUserRole,
    userPermissions,
    isAdmin,
    isManager,
    isOperator,
    canManageUsers,
    canManageSystem,
    
    // Permission checking
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    checkPermission,
    
    // Resource-specific checks
    canControlMachine,
    canStopMachine,
    canEmergencyStop,
    canConfigureMachine,
    canCreateTask,
    canEditTask,
    canDeleteTask,
    canManageYard,
    canViewUserData,
    
    // Utility methods
    getRoleName,
    getPermissionsByResource,
    getResourceActions,
    hasResourceAccess,
    shouldShowFeature,
    getAccessibleRoutes,
    filterByPermissions,
    
    // Role management
    getUserRole,
    canAssignRole,
    getAssignableRoles,
    
    // Debug helpers
    debugPermissions,
    getAllPermissions,
    getAllRoles
  }
}