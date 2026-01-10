# YardRover Zone Types Reference

**Version**: 1.0
**Last Updated**: 2026-01-10
**Status**: Implemented

---

## Overview

YardRover supports **10 distinct zone types**, each designed for specific operational use cases. Zones define geographic boundaries where the machine performs different tasks, from basic lawn mowing to advanced environmental monitoring.

This document provides a comprehensive reference for all zone types, their settings, and use cases.

---

## Zone Type Categories

### **Core Types** (Always Available)
- **Mowing** - Autonomous lawn care
- **Exclusion** - No-go safety zones
- **Charging** - Power station locations

### **Operational Types** (Feature-Gated)
- **Patrol** - Security surveillance
- **Snow Clearing** - Winter operations
- **Staging** - Material storage

### **Agricultural/Maintenance Types** (Feature-Gated)
- **Spraying** - Chemical/fertilizer application
- **Watering** - Irrigation management
- **Collection** - Debris removal
- **Monitoring** - Environmental sensing

---

## Zone Type Details

### 1. Mowing Zone 🌱

**Type ID**: `mowing`
**Color**: `#2C5F2D` (Forest Green)
**Consumer Name**: "Work Area"
**Requires Feature**: None (always available)

**Description**: Areas designated for autonomous lawn mowing operations.

**Settings**:
```typescript
{
  mowing_height: number      // Height in cm (1-15, default: 3.5)
  pattern: string            // "stripe" | "spiral" | "random" | "checkerboard"
  edge_mode: string          // "trim" | "skip" | "overlap"
  overlap: number            // Path overlap % (0-50, default: 10)
}
```

**Use Cases**:
- Residential lawns
- Parks and recreation areas
- Golf course fairways
- Athletic field maintenance

---

### 2. Exclusion Zone 🚫

**Type ID**: `exclusion`
**Color**: `#dc3545` (Red)
**Consumer Name**: "Keep-Out Zone"
**Requires Feature**: None (always available)

**Description**: No-go zones that prevent the machine from entering restricted or hazardous areas.

**Settings**: None (boundary-only definition)

**Use Cases**:
- Flower beds and gardens
- Water features (ponds, pools)
- Playground equipment
- Property boundaries
- Obstacles (trees, rocks, structures)

---

### 3. Charging Station ⚡

**Type ID**: `charging`
**Color**: `#ffc107` (Yellow/Amber)
**Consumer Name**: "Charging Spot"
**Requires Feature**: None (always available)

**Description**: Designated location for the machine's charging dock.

**Settings**: None (position-only definition)

**Use Cases**:
- Home base for autonomous return
- Battery recharge operations
- Storage location when idle

---

### 4. Patrol Route 👁️

**Type ID**: `patrol`
**Color**: `#17a2b8` (Info Blue)
**Consumer Name**: "Security Route"
**Requires Feature**: `security_patrol`

**Description**: Security surveillance and perimeter monitoring zones.

**Settings**:
```typescript
{
  schedule: string           // Cron expression (e.g., "0 */2 * * *")
  dwell_time: number         // Seconds at each waypoint (0-300, default: 30)
  motion_detection: boolean  // Enable motion alerts (default: true)
  recording_enabled: boolean // Enable video recording (default: false)
  speed: number              // Patrol speed m/s (0.1-2.0, default: 0.5)
}
```

**Use Cases**:
- Property perimeter security
- Night-time surveillance
- Event monitoring
- Intrusion detection

---

### 5. Snow Clearing Zone ❄️

**Type ID**: `snow_clearing`
**Color**: `#87CEEB` (Sky Blue)
**Consumer Name**: "Snow Clearing Area"
**Requires Feature**: `snow_clearing`

**Description**: Winter snow removal zones with priority-based clearing.

**Settings**:
```typescript
{
  priority: number           // 1=high, 2=medium, 3=low
  clearing_height: number    // Snow depth threshold cm (1-30, default: 5)
  pattern: string            // "back_and_forth" | "spiral" | "perimeter_first"
  salt_application: boolean  // Apply de-icing salt (default: false)
  edge_clearing: boolean     // Clear edges/borders (default: true)
}
```

**Use Cases**:
- Driveway snow removal
- Walkway clearing
- Parking area maintenance
- High-priority access routes

---

### 6. Staging Area 📦

**Type ID**: `staging`
**Color**: `#6c757d` (Gray)
**Consumer Name**: "Storage Spot"
**Requires Feature**: None (always available)

**Description**: Material staging, storage, or dumping locations.

**Settings**:
```typescript
{
  max_capacity: number       // Cubic meters (optional)
  material_type: string      // "debris" | "mulch" | "soil" | "general"
  auto_compact: boolean      // Auto-compact material (default: false)
}
```

**Use Cases**:
- Debris dumping location
- Mulch/soil storage
- Material staging for projects
- Collection bag emptying point

---

### 7. Spraying Zone 💧

**Type ID**: `spraying`
**Color**: `#7CB342` (Grass Green)
**Consumer Name**: "Fertilizing Area"
**Requires Feature**: `precision_spraying`

**Description**: Chemical or fertilizer application zones with precision control.

**Settings**:
```typescript
{
  spray_rate: number         // Liters per m² (0.1-10, default: 1.5)
  chemical_type: string      // Chemical/fertilizer identifier
  wind_limit: number         // Max wind speed km/h (0-30, default: 15)
  buffer_zone: number        // Edge buffer meters (0-10, default: 2.0)
  nozzle_height: number      // Spray height cm (10-100, default: 30)
}
```

**Use Cases**:
- Lawn fertilization
- Weed control
- Pest management
- Disease prevention treatments

---

### 8. Watering Zone 💦

**Type ID**: `watering`
**Color**: `#4FC3F7` (Light Blue)
**Consumer Name**: "Watering Area"
**Requires Feature**: `irrigation`

**Description**: Irrigation and watering zones with soil moisture awareness.

**Settings**:
```typescript
{
  schedule: string           // Cron expression for watering schedule
  duration: number           // Minutes per session (1-60, default: 15)
  moisture_threshold: number // Soil moisture % trigger (0-100, default: 30)
  flow_rate: number          // Liters per minute (0.1-20, default: 2.0)
  skip_if_rain: boolean      // Skip on rain detection (default: true)
}
```

**Use Cases**:
- Drought management
- New seed establishment
- Garden bed irrigation
- Moisture-based smart watering

---

### 9. Collection Zone 🍂

**Type ID**: `collection`
**Color**: `#8D6E63` (Brown)
**Consumer Name**: "Cleanup Area"
**Requires Feature**: `debris_collection`

**Description**: Debris and leaf collection zones.

**Settings**:
```typescript
{
  vacuum_power: number       // Vacuum power % (10-100, default: 80)
  pattern: string            // "back_and_forth" | "spiral" | "perimeter_first"
  bag_capacity: number       // Capacity liters (1-50, default: 10)
  auto_return_when_full: boolean // Return to dump when full (default: true)
}
```

**Use Cases**:
- Fall leaf cleanup
- Grass clipping collection
- Yard debris removal
- Pre-event cleaning

---

### 10. Monitoring Zone 📊

**Type ID**: `monitoring`
**Color**: `#9C27B0` (Purple)
**Consumer Name**: "Sensor Area"
**Requires Feature**: `environmental_monitoring`

**Description**: Environmental monitoring and data collection zones.

**Settings**:
```typescript
{
  sensors: string[]          // Enabled sensors: ["temperature", "humidity", ...]
  sample_interval: number    // Seconds between samples (10-3600, default: 300)
  alert_enabled: boolean     // Enable threshold alerts (default: false)
  temperature_min: number    // Min temp alert °C (optional)
  temperature_max: number    // Max temp alert °C (optional)
  humidity_min: number       // Min humidity % (0-100, optional)
  humidity_max: number       // Max humidity % (0-100, optional)
}
```

**Use Cases**:
- Microclimate mapping
- Air quality monitoring
- Garden planning data
- Fire weather monitoring

---

## Feature Flags

Some zone types require specific feature flags to be enabled:

| Zone Type | Feature Flag | Description |
|-----------|-------------|-------------|
| Patrol | `security_patrol` | Security surveillance features |
| Snow Clearing | `snow_clearing` | Winter operation mode |
| Spraying | `precision_spraying` | Chemical application hardware |
| Watering | `irrigation` | Irrigation system integration |
| Collection | `debris_collection` | Vacuum/collection hardware |
| Monitoring | `environmental_monitoring` | Environmental sensor suite |

---

## User Mode Adaptation

Zone type names and descriptions adapt based on the user mode:

### Consumer Mode
- Friendly, simple language
- "Work Area" instead of "Mowing Zone"
- "Keep-Out Zone" instead of "Exclusion Zone"
- Emoji icons for visual appeal

### Power User / Developer Mode
- Technical terminology
- "Mowing Zone", "Patrol Route"
- Detailed settings exposure
- Advanced configuration options

---

## Implementation Details

### Backend (Python)
- **Enum**: `yardrover.models.resources.ZoneType`
- **Settings Schemas**: `yardrover.models.zone_settings.*Settings`
- **Metadata**: `yardrover.models.zone_metadata.ZONE_TYPE_METADATA`

### Client Library (TypeScript)
- **Type**: `ZoneType` (exported from `@client`)
- **Metadata**: `ZONE_TYPE_METADATA` object
- **Utilities**: `getZoneTypeName()`, `getZoneTypeColor()`, etc.

### Frontend (Vue 3)
- **Type Selector**: `<ZoneTypeSelector>` component
- **Type-Specific Settings**: Settings components per type
- **Store Filters**: `zonesStore.mowingZones`, `zonesStore.patrolZones`, etc.
- **Icon Map**: Zone type icons in `iconMap`

---

## API Usage Examples

### Creating a Mowing Zone

```typescript
const zone: Zone = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Front Lawn',
  type: 'mowing',
  coordinates: [
    [-122.4194, 37.7749],
    [-122.4184, 37.7749],
    [-122.4184, 37.7739],
    [-122.4194, 37.7739],
  ],
  color: '#2C5F2D',
  area: 1000.5,
  description: 'Main front lawn area',
  tags: ['front', 'primary'],
  settings: {
    mowing_height: 3.5,
    pattern: 'stripe',
    edge_mode: 'trim',
    overlap: 10
  },
  created: '2024-01-08T10:00:00Z',
  lastModified: '2024-01-08T10:00:00Z'
}

await client.zones.create(zone)
```

### Creating a Patrol Route

```typescript
const patrolZone: Zone = {
  id: uuid(),
  name: 'Perimeter Security',
  type: 'patrol',
  coordinates: [ /* boundary coordinates */ ],
  color: '#17a2b8',
  area: 500.0,
  settings: {
    schedule: '0 */2 * * *',  // Every 2 hours
    dwell_time: 45,
    motion_detection: true,
    recording_enabled: true,
    speed: 0.5
  },
  created: new Date().toISOString(),
  lastModified: new Date().toISOString()
}

await client.zones.create(patrolZone)
```

### Filtering Zones by Type

```typescript
// Using zone manager
const mowingZones = await client.zones.getByType('mowing')
const patrolZones = await client.zones.getByType('patrol')

// Using frontend store
import { useZonesStore } from '@/stores/zones'
const zonesStore = useZonesStore()
const mowingZones = zonesStore.mowingZones
const patrolZones = zonesStore.patrolZones
```

### Getting Zone Type Metadata

```typescript
import { getZoneTypeName, getZoneTypeColor, getZoneTypeIcon } from '@client'

const name = getZoneTypeName('mowing', false)  // "Mowing Zone"
const consumerName = getZoneTypeName('mowing', true)  // "Work Area"
const color = getZoneTypeColor('mowing')  // "#2C5F2D"
const icon = getZoneTypeIcon('mowing')  // "🌱"
```

---

## Best Practices

### 1. Zone Design
- **Mowing zones**: Avoid complex shapes with many vertices (simplify for efficiency)
- **Exclusion zones**: Add buffer space around obstacles for safety
- **Patrol routes**: Use perimeter-based polygons for continuous coverage
- **Snow clearing**: Prioritize high-traffic areas with priority=1

### 2. Settings Configuration
- **Test settings**: Start conservative, tune based on results
- **Weather awareness**: Use wind limits for spraying, skip_if_rain for watering
- **Sensor placement**: Monitoring zones should cover representative areas
- **Buffer zones**: Always use buffer zones for chemical applications

### 3. Feature Enablement
- Enable features incrementally based on hardware availability
- Test feature-gated zone types in developer mode first
- Communicate feature requirements clearly in UI

---

## Migration Guide

### From v1.0 (3 zone types) to v2.0 (10 zone types)

**Backward Compatibility**: ✅ Maintained

Existing zones with types `mowing`, `exclusion`, or `charging` will continue to work without modification. New zone types are additive.

**Steps**:
1. Update backend (`ZoneType` enum expanded)
2. Rebuild client library (`npm run build` in `client/`)
3. Update frontend types (import from `@client`)
4. Enable desired feature flags in settings
5. New zone types become available automatically

No database migrations required - zone `type` field accepts all new values.

---

## Troubleshooting

### Zone type not appearing in selector
- **Check feature flags**: Ensure required feature is enabled
- **Check user mode**: Some types hidden in consumer mode
- **Rebuild client**: Run `cd client && npm run build`

### Settings validation errors
- **Check schema**: Refer to type-specific settings above
- **Range validation**: Ensure values within min/max bounds
- **Type mismatch**: Settings must match zone type

### Zone creation fails
- **Coordinates**: Must have ≥3 points for valid polygon
- **Color format**: Must be hex code `#RRGGBB`
- **Area calculation**: Automatically calculated, don't set manually

---

## See Also

- **[ARCHITECTURE.md](../ARCHITECTURE.md)** - System architecture overview
- **[FEATURES.md](../FEATURES.md)** - Feature matrix and user modes
- **[API_GUIDE.md](../API_GUIDE.md)** - API usage examples
- **[ZONE_RECORDING_STATUS.md](./ZONE_RECORDING_STATUS.md)** - Zone recording feature

---

**Last Updated**: 2026-01-10
**Maintainer**: YardRover Development Team
