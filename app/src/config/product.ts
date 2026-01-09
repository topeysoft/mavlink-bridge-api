/**
 * Product branding and configuration
 *
 * This file centralizes all product-specific branding and metadata.
 * Change the product name, descriptions, and URLs here to rebrand the entire application.
 */

export interface ProductConfig {
  /** Full product name (e.g., "YardRover") */
  name: string

  /** Short name or abbreviation (e.g., "YR") */
  shortName: string

  /** Product tagline */
  tagline: string

  /** Brief product description */
  description: string

  /** Company/organization name */
  company: string

  /** Support contact email */
  supportEmail: string

  /** Documentation URL */
  docsUrl: string

  /** Product website */
  websiteUrl: string

  /** GitHub repository (optional) */
  githubUrl?: string

  /** Version display format */
  versionPrefix: string
}

/**
 * Current product configuration
 *
 * To rebrand the application, modify the values below.
 * All references throughout the app will automatically update.
 */
export const PRODUCT_CONFIG: ProductConfig = {
  name: 'YardRover',
  shortName: 'YR',
  tagline: 'Your Autonomous Yard Assistant',
  description: 'Autonomous yard utility machine with web-based control interface',
  company: 'YardRover',
  supportEmail: 'support@yardrover.local',
  docsUrl: 'https://docs.yardrover.local',
  websiteUrl: 'https://yardrover.local',
  githubUrl: 'https://github.com/yourorg/yardrover',
  versionPrefix: 'v',
}

/**
 * API key prefix for the product
 */
export const API_KEY_PREFIX = PRODUCT_CONFIG.shortName.toLowerCase()

/**
 * Default device hostname pattern
 */
export const DEFAULT_DEVICE_HOSTNAME = `${PRODUCT_CONFIG.name.toLowerCase()}.local`

/**
 * LocalStorage key prefix
 */
export const STORAGE_KEY_PREFIX = `${PRODUCT_CONFIG.name.toLowerCase()}_`
