/**
 * Centralized icon mapping for YardRover UI
 *
 * Maps semantic icon names to Lucide Vue components.
 * This provides a consistent icon system across the application.
 */

import type { Component } from 'vue'
import {
  LayoutDashboard,
  Plug,
  MapPin,
  ListTodo,
  Gamepad2,
  Monitor,
  Calendar,
  FileText,
  Target,
  Radio,
  Sliders,
  Battery,
  CloudRain,
  Settings,
  User,
  Sun,
  Moon,
  LogOut,
  Clock,
  Wifi,
  WifiOff,
  AlertCircle,
  CheckCircle,
  XCircle,
  Info,
  AlertTriangle,
  Menu,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  X,
  Plus,
  Minus,
  Edit,
  Trash,
  Save,
  Download,
  Upload,
  RefreshCw,
  Play,
  Pause,
  Square,
  Home,
  Navigation,
  Flag,
  Shield,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Search,
  Filter,
  Zap,
  Wifi as WifiConnected,
  // Peripheral icons
  Scissors,
  Package,
  Leaf,
  ScanLine,
  Wind,
  Sprout,
  Snowflake,
  Mountain,
  Droplets,
  Tractor,
  Trash2,
  Camera,
  Gauge,
  Network,
  Radar,
  Power,
  Lightbulb,
  Link,
  MapPinned,
  Compass,
  BatteryCharging,
  Cog,
  PlugZap
} from 'lucide-vue-next'

export type IconName =
  // Navigation
  | 'dashboard'
  | 'peripherals'
  | 'zones'
  | 'missions'
  | 'control'
  | 'monitoring'
  | 'schedule'
  | 'logs'
  | 'calibration'
  | 'rtcm'
  | 'parameters'
  | 'battery'
  | 'weather'
  | 'settings'
  // UI Elements
  | 'user'
  | 'sun'
  | 'moon'
  | 'logout'
  | 'menu'
  | 'home'
  // Status
  | 'clock'
  | 'wifi'
  | 'wifi-off'
  | 'wifi-connected'
  | 'alert-circle'
  | 'check-circle'
  | 'x-circle'
  | 'info'
  | 'alert-triangle'
  // Actions
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-up'
  | 'chevron-down'
  | 'x'
  | 'plus'
  | 'minus'
  | 'edit'
  | 'trash'
  | 'save'
  | 'download'
  | 'upload'
  | 'refresh'
  | 'play'
  | 'pause'
  | 'stop'
  // Misc
  | 'navigation'
  | 'flag'
  | 'shield'
  | 'lock'
  | 'unlock'
  | 'eye'
  | 'eye-off'
  | 'search'
  | 'filter'
  | 'zap'
  // Peripheral Types
  | 'peripheral-mower'
  | 'peripheral-grass-collector'
  | 'peripheral-mulcher'
  | 'peripheral-edger'
  | 'peripheral-aerator'
  | 'peripheral-seeder'
  | 'peripheral-snow-blower'
  | 'peripheral-snow-plow'
  | 'peripheral-salt-spreader'
  | 'peripheral-sprayer'
  | 'peripheral-fertilizer-spreader'
  | 'peripheral-vacuum'
  | 'peripheral-leaf-blower'
  | 'peripheral-debris-collector'
  | 'peripheral-camera'
  | 'peripheral-environmental-sensor'
  | 'peripheral-soil-sensor'
  | 'peripheral-lidar'
  | 'peripheral-power-module'
  | 'peripheral-lighting'
  | 'peripheral-trailer-hitch'
  | 'peripheral-builtin-gps'
  | 'peripheral-builtin-imu'
  | 'peripheral-builtin-battery'
  | 'peripheral-custom'
  | 'peripheral-off'
  // Zone Types
  | 'zone-mowing'
  | 'zone-exclusion'
  | 'zone-charging'
  | 'zone-patrol'
  | 'zone-snow-clearing'
  | 'zone-staging'
  | 'zone-spraying'
  | 'zone-watering'
  | 'zone-collection'
  | 'zone-monitoring'

/**
 * Icon component map
 */
export const iconMap: Record<IconName, Component> = {
  // Navigation
  dashboard: LayoutDashboard,
  peripherals: Plug,
  zones: MapPin,
  missions: ListTodo,
  control: Gamepad2,
  monitoring: Monitor,
  schedule: Calendar,
  logs: FileText,
  calibration: Target,
  rtcm: Radio,
  parameters: Sliders,
  battery: Battery,
  weather: CloudRain,
  settings: Settings,
  // UI Elements
  user: User,
  sun: Sun,
  moon: Moon,
  logout: LogOut,
  menu: Menu,
  home: Home,
  // Status
  clock: Clock,
  wifi: Wifi,
  'wifi-off': WifiOff,
  'wifi-connected': WifiConnected,
  'alert-circle': AlertCircle,
  'check-circle': CheckCircle,
  'x-circle': XCircle,
  info: Info,
  'alert-triangle': AlertTriangle,
  // Actions
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'chevron-up': ChevronUp,
  'chevron-down': ChevronDown,
  x: X,
  plus: Plus,
  minus: Minus,
  edit: Edit,
  trash: Trash,
  save: Save,
  download: Download,
  upload: Upload,
  refresh: RefreshCw,
  play: Play,
  pause: Pause,
  stop: Square,
  // Misc
  navigation: Navigation,
  flag: Flag,
  shield: Shield,
  lock: Lock,
  unlock: Unlock,
  eye: Eye,
  'eye-off': EyeOff,
  search: Search,
  filter: Filter,
  zap: Zap,
  // Peripheral Types
  'peripheral-mower': Scissors,
  'peripheral-grass-collector': Package,
  'peripheral-mulcher': Leaf,
  'peripheral-edger': ScanLine,
  'peripheral-aerator': Wind,
  'peripheral-seeder': Sprout,
  'peripheral-snow-blower': Snowflake,
  'peripheral-snow-plow': Mountain,
  'peripheral-salt-spreader': Droplets,
  'peripheral-sprayer': Droplets,
  'peripheral-fertilizer-spreader': Tractor,
  'peripheral-vacuum': Trash2,
  'peripheral-leaf-blower': Wind,
  'peripheral-debris-collector': Trash2,
  'peripheral-camera': Camera,
  'peripheral-environmental-sensor': Gauge,
  'peripheral-soil-sensor': Network,
  'peripheral-lidar': Radar,
  'peripheral-power-module': Power,
  'peripheral-lighting': Lightbulb,
  'peripheral-trailer-hitch': Link,
  'peripheral-builtin-gps': MapPinned,
  'peripheral-builtin-imu': Compass,
  'peripheral-builtin-battery': BatteryCharging,
  'peripheral-custom': Cog,
  'peripheral-off': PlugZap,
  // Zone Types
  'zone-mowing': Scissors,
  'zone-exclusion': Shield,
  'zone-charging': BatteryCharging,
  'zone-patrol': Eye,
  'zone-snow-clearing': Snowflake,
  'zone-staging': Package,
  'zone-spraying': Droplets,
  'zone-watering': Droplets,
  'zone-collection': Trash2,
  'zone-monitoring': Gauge
}

/**
 * Get icon component by name
 */
export function getIcon(name: IconName): Component {
  const icon = iconMap[name]
  if (!icon) {
    console.warn(`Icon "${name}" not found in iconMap`)
    return AlertCircle // Fallback icon
  }
  return icon
}
