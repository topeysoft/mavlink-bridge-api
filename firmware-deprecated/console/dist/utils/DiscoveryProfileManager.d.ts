import type { DiscoveryOptions } from '@mavlinkbridge/api-client';
export interface DiscoveryProfile {
    name: string;
    description?: string;
    options: DiscoveryOptions;
    createdAt: string;
    lastUsed?: string;
}
export declare class DiscoveryProfileManager {
    private profileDir;
    private profileFile;
    constructor();
    /**
     * Ensure the profile directory exists
     */
    private ensureProfileDir;
    /**
     * Load all saved profiles
     */
    loadProfiles(): Promise<DiscoveryProfile[]>;
    /**
     * Save a new profile
     */
    saveProfile(profile: Omit<DiscoveryProfile, 'createdAt'>): Promise<void>;
    /**
     * Delete a profile by name
     */
    deleteProfile(name: string): Promise<boolean>;
    /**
     * Get a profile by name
     */
    getProfile(name: string): Promise<DiscoveryProfile | null>;
    /**
     * Update last used timestamp for a profile
     */
    markProfileUsed(name: string): Promise<void>;
    /**
     * Get default profiles
     */
    getDefaultProfiles(): DiscoveryProfile[];
}
//# sourceMappingURL=DiscoveryProfileManager.d.ts.map