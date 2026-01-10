/**
 * Authentication types and interfaces
 */

/**
 * User roles for RBAC
 */
export enum Role {
  VIEWER = 'viewer',
  OPERATOR = 'operator',
  ADMIN = 'admin',
}

/**
 * Permissions for fine-grained access control
 */
export enum Permission {
  // View permissions
  VIEW_STATUS = 'view_status',
  VIEW_CONFIG = 'view_config',
  VIEW_TELEMETRY = 'view_telemetry',

  // Control permissions
  CONTROL_VEHICLE = 'control_vehicle',
  CONTROL_MISSIONS = 'control_missions',
  CONTROL_MODES = 'control_modes',

  // Configuration permissions
  CONFIGURE_DEVICE = 'configure_device',
  CONFIGURE_NETWORK = 'configure_network',
  CONFIGURE_SERIAL = 'configure_serial',

  // Admin permissions
  MANAGE_API_KEYS = 'manage_api_keys',
  MANAGE_USERS = 'manage_users',
  MANAGE_SYSTEM = 'manage_system',
}

/**
 * Login request with API key
 */
export interface LoginRequest {
  /**
   * API key for authentication
   */
  api_key: string;
}

/**
 * Login request with username and password
 */
export interface UserLoginRequest {
  /**
   * Username
   */
  username: string;

  /**
   * Password
   */
  password: string;
}

/**
 * Login request with PIN
 */
export interface PinLoginRequest {
  /**
   * 4-6 digit PIN
   */
  pin: string;
}

/**
 * Login response with JWT tokens
 */
export interface LoginResponse {
  /**
   * JWT access token (short-lived, 15 minutes)
   */
  access_token: string;

  /**
   * JWT refresh token (long-lived, 7 days)
   */
  refresh_token: string;

  /**
   * Token type (always "bearer")
   */
  token_type: string;

  /**
   * Access token expiration time in seconds
   */
  expires_in: number;

  /**
   * User's role
   */
  role: Role;
}

/**
 * Refresh token request
 */
export interface RefreshTokenRequest {
  /**
   * Refresh token to exchange for new access token
   */
  refresh_token: string;
}

/**
 * Refresh token response
 */
export interface RefreshTokenResponse {
  /**
   * New JWT access token
   */
  access_token: string;

  /**
   * Token type (always "bearer")
   */
  token_type: string;

  /**
   * Access token expiration time in seconds
   */
  expires_in: number;
}

/**
 * Logout request
 */
export interface LogoutRequest {
  /**
   * Refresh token to revoke
   */
  refresh_token: string;
}

/**
 * Token data decoded from JWT
 */
export interface TokenData {
  /**
   * Subject (API key ID)
   */
  sub: string;

  /**
   * User role
   */
  role: Role;

  /**
   * Permissions granted to this token
   */
  permissions: Permission[];

  /**
   * Token expiration timestamp (Unix epoch)
   */
  exp: number;

  /**
   * Token issued at timestamp (Unix epoch)
   */
  iat: number;
}

/**
 * API key creation request
 */
export interface APIKeyCreateRequest {
  /**
   * Human-readable name for the key
   */
  name: string;

  /**
   * Role to assign to this key
   */
  role: Role;

  /**
   * Optional description
   */
  description?: string;

  /**
   * Optional expiration in days
   */
  expires_in_days?: number;
}

/**
 * API key creation response
 */
export interface APIKeyCreateResponse {
  /**
   * Unique key ID
   */
  key_id: string;

  /**
   * Human-readable name
   */
  name: string;

  /**
   * The actual API key (shown only once!)
   */
  api_key: string;

  /**
   * Assigned role
   */
  role: Role;

  /**
   * Creation timestamp
   */
  created_at: string;

  /**
   * Optional expiration timestamp
   */
  expires_at?: string;
}

/**
 * API key list item (no sensitive data)
 */
export interface APIKeyListItem {
  /**
   * Unique key ID
   */
  key_id: string;

  /**
   * Human-readable name
   */
  name: string;

  /**
   * Assigned role
   */
  role: Role;

  /**
   * Creation timestamp
   */
  created_at: string;

  /**
   * Optional expiration timestamp
   */
  expires_at?: string;

  /**
   * Last used timestamp
   */
  last_used_at?: string;

  /**
   * Whether key is enabled
   */
  enabled: boolean;

  /**
   * Optional description
   */
  description?: string;
}

/**
 * Current user information
 */
export interface CurrentUser {
  /**
   * Subject ID (user ID or API key ID)
   */
  subject_id: string;

  /**
   * Subject type ('user' or 'api_key')
   */
  subject_type: string;

  /**
   * Subject name (username or API key name)
   */
  subject_name: string;

  /**
   * User role
   */
  role: Role;

  /**
   * User permissions
   */
  permissions: Permission[];

  /**
   * Whether user is authenticated
   */
  authenticated: boolean;

  /**
   * API key ID (for backward compatibility)
   */
  api_key_id?: string;

  /**
   * API key name (for backward compatibility)
   */
  api_key_name?: string;
}

/**
 * Setup status response
 */
export interface SetupStatus {
  /**
   * Whether initial setup has been completed
   */
  setup_completed: boolean;

  /**
   * Whether an admin API key exists
   */
  has_admin_key: boolean;

  /**
   * Current device name
   */
  device_name: string;

  /**
   * Whether device is in setup mode
   */
  in_setup_mode: boolean;
}

/**
 * Complete setup request
 */
export interface CompleteSetupRequest {
  /**
   * Device name to set
   */
  device_name: string;

  /**
   * Admin username
   */
  username: string;

  /**
   * Admin password (min 8 characters)
   */
  password: string;

  /**
   * Optional display name
   */
  display_name?: string;

  /**
   * Optional PIN (4-6 digits) for consumer mode
   */
  pin?: string;

  /**
   * Name for the admin API key
   */
  admin_key_name?: string;

  /**
   * Description for the admin key
   */
  admin_key_description?: string;
}

/**
 * Complete setup response
 */
export interface CompleteSetupResponse {
  /**
   * Whether setup was successful
   */
  success: boolean;

  /**
   * Created user ID
   */
  user_id: string;

  /**
   * Created username
   */
  username: string;

  /**
   * Generated admin API key (shown only once!)
   */
  api_key: string;

  /**
   * Device name
   */
  device_name: string;

  /**
   * Success message
   */
  message: string;
}

/**
 * Change password request
 */
export interface ChangePasswordRequest {
  /**
   * Current password
   */
  old_password: string;

  /**
   * New password (min 8 characters)
   */
  new_password: string;
}

/**
 * Set PIN request
 */
export interface SetPinRequest {
  /**
   * 4-6 digit PIN
   */
  pin: string;

  /**
   * Current password for verification
   */
  password: string;
}

/**
 * Generic success response
 */
export interface SuccessResponse {
  /**
   * Success message
   */
  message: string;
}

/**
 * Authentication state
 */
export interface AuthState {
  /**
   * Whether user is authenticated
   */
  authenticated: boolean;

  /**
   * JWT access token (short-lived)
   */
  accessToken: string | null;

  /**
   * JWT refresh token (long-lived)
   */
  refreshToken: string | null;

  /**
   * Access token expiration time (Unix epoch)
   */
  expiresAt: number | null;

  /**
   * Refresh token expiration time (Unix epoch)
   */
  refreshExpiresAt: number | null;

  /**
   * User role
   */
  role: Role | null;

  /**
   * User permissions
   */
  permissions: Permission[];

  /**
   * Current user info
   */
  user: CurrentUser | null;
}
