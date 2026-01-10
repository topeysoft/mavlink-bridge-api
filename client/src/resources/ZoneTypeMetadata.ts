/**
 * Zone type metadata and constants
 *
 * Defines metadata for each zone type including default colors,
 * icons, display names, and consumer-friendly labels.
 */

import type { ZoneType } from './ResourceTypes';

export interface ZoneTypeInfo {
  color: string; // Hex color code
  icon: string; // Emoji or icon identifier
  name: string; // Technical display name
  consumerName: string; // Consumer-friendly display name
  description: string; // Short description
  consumerDescription: string; // Consumer-friendly description
  requiresFeature: string | null; // Feature flag requirement (if any)
}

/**
 * Zone type metadata dictionary
 */
export const ZONE_TYPE_METADATA: Record<ZoneType, ZoneTypeInfo> = {
  mowing: {
    color: '#2C5F2D', // Forest green
    icon: '🌱',
    name: 'Mowing Zone',
    consumerName: 'Work Area',
    description: 'Area for autonomous lawn mowing',
    consumerDescription: 'Where your YardRover will mow the lawn',
    requiresFeature: null,
  },
  exclusion: {
    color: '#dc3545', // Red
    icon: '🚫',
    name: 'Exclusion Zone',
    consumerName: 'Keep-Out Zone',
    description: 'No-go zone to avoid obstacles or restricted areas',
    consumerDescription: 'Places your YardRover will stay away from',
    requiresFeature: null,
  },
  charging: {
    color: '#ffc107', // Yellow/amber
    icon: '⚡',
    name: 'Charging Station',
    consumerName: 'Charging Spot',
    description: 'Designated charging station location',
    consumerDescription: 'Where your YardRover goes to recharge',
    requiresFeature: null,
  },
  patrol: {
    color: '#17a2b8', // Info blue
    icon: '👁️',
    name: 'Patrol Route',
    consumerName: 'Security Route',
    description: 'Security surveillance and perimeter monitoring zone',
    consumerDescription: 'Route for keeping watch over your property',
    requiresFeature: 'security_patrol',
  },
  snow_clearing: {
    color: '#87CEEB', // Sky blue
    icon: '❄️',
    name: 'Snow Clearing Zone',
    consumerName: 'Snow Clearing Area',
    description: 'Winter snow removal zone',
    consumerDescription: 'Areas to clear when it snows',
    requiresFeature: 'snow_clearing',
  },
  staging: {
    color: '#6c757d', // Gray
    icon: '📦',
    name: 'Staging Area',
    consumerName: 'Storage Spot',
    description: 'Material staging, storage, or dumping location',
    consumerDescription: 'Place to drop off collected materials',
    requiresFeature: null,
  },
  spraying: {
    color: '#7CB342', // Grass green
    icon: '💧',
    name: 'Spraying Zone',
    consumerName: 'Fertilizing Area',
    description: 'Chemical/fertilizer application zone',
    consumerDescription: 'Areas to fertilize or treat',
    requiresFeature: 'precision_spraying',
  },
  watering: {
    color: '#4FC3F7', // Light blue
    icon: '💦',
    name: 'Watering Zone',
    consumerName: 'Watering Area',
    description: 'Irrigation and watering zone',
    consumerDescription: 'Places that need regular watering',
    requiresFeature: 'irrigation',
  },
  collection: {
    color: '#8D6E63', // Brown
    icon: '🍂',
    name: 'Collection Zone',
    consumerName: 'Cleanup Area',
    description: 'Debris and leaf collection zone',
    consumerDescription: 'Areas to clean up leaves and debris',
    requiresFeature: 'debris_collection',
  },
  monitoring: {
    color: '#9C27B0', // Purple
    icon: '📊',
    name: 'Monitoring Zone',
    consumerName: 'Sensor Area',
    description: 'Environmental monitoring and data collection zone',
    consumerDescription: 'Places to check temperature, humidity, and conditions',
    requiresFeature: 'environmental_monitoring',
  },
};

/**
 * Get default color for a zone type
 */
export function getZoneTypeColor(zoneType: ZoneType): string {
  return ZONE_TYPE_METADATA[zoneType].color;
}

/**
 * Get icon for a zone type
 */
export function getZoneTypeIcon(zoneType: ZoneType): string {
  return ZONE_TYPE_METADATA[zoneType].icon;
}

/**
 * Get display name for a zone type
 */
export function getZoneTypeName(zoneType: ZoneType, consumerMode = false): string {
  const metadata = ZONE_TYPE_METADATA[zoneType];
  return consumerMode ? metadata.consumerName : metadata.name;
}

/**
 * Get description for a zone type
 */
export function getZoneTypeDescription(zoneType: ZoneType, consumerMode = false): string {
  const metadata = ZONE_TYPE_METADATA[zoneType];
  return consumerMode ? metadata.consumerDescription : metadata.description;
}

/**
 * Get required feature flag for a zone type
 */
export function getRequiredFeature(zoneType: ZoneType): string | null {
  return ZONE_TYPE_METADATA[zoneType].requiresFeature;
}

/**
 * Check if a zone type is available based on enabled features
 */
export function isZoneTypeAvailable(
  zoneType: ZoneType,
  enabledFeatures: Set<string>
): boolean {
  const requiredFeature = getRequiredFeature(zoneType);
  if (requiredFeature === null) {
    return true;
  }
  return enabledFeatures.has(requiredFeature);
}

/**
 * Get all available zone types based on enabled features
 */
export function getAvailableZoneTypes(enabledFeatures: Set<string>): ZoneType[] {
  return (Object.keys(ZONE_TYPE_METADATA) as ZoneType[]).filter((type) =>
    isZoneTypeAvailable(type, enabledFeatures)
  );
}
