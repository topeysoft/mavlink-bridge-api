import fs from 'fs/promises';
import path from 'path';
import os from 'os';
export class DiscoveryProfileManager {
    profileDir;
    profileFile;
    constructor() {
        // Store profiles in user's home directory
        this.profileDir = path.join(os.homedir(), '.yardrover');
        this.profileFile = path.join(this.profileDir, 'discovery-profiles.json');
    }
    /**
     * Ensure the profile directory exists
     */
    async ensureProfileDir() {
        try {
            await fs.mkdir(this.profileDir, { recursive: true });
        }
        catch (error) {
            console.error('Failed to create profile directory:', error);
        }
    }
    /**
     * Load all saved profiles
     */
    async loadProfiles() {
        try {
            await this.ensureProfileDir();
            const data = await fs.readFile(this.profileFile, 'utf-8');
            return JSON.parse(data);
        }
        catch (error) {
            // Return empty array if file doesn't exist or is corrupted
            return [];
        }
    }
    /**
     * Save a new profile
     */
    async saveProfile(profile) {
        await this.ensureProfileDir();
        const profiles = await this.loadProfiles();
        // Check if profile with same name exists
        const existingIndex = profiles.findIndex(p => p.name === profile.name);
        const newProfile = {
            ...profile,
            createdAt: existingIndex >= 0 ? profiles[existingIndex].createdAt : new Date().toISOString(),
            lastUsed: new Date().toISOString()
        };
        if (existingIndex >= 0) {
            // Update existing profile
            profiles[existingIndex] = newProfile;
        }
        else {
            // Add new profile
            profiles.push(newProfile);
        }
        // Sort by last used (most recent first)
        profiles.sort((a, b) => {
            const aTime = a.lastUsed || a.createdAt;
            const bTime = b.lastUsed || b.createdAt;
            return bTime.localeCompare(aTime);
        });
        await fs.writeFile(this.profileFile, JSON.stringify(profiles, null, 2));
    }
    /**
     * Delete a profile by name
     */
    async deleteProfile(name) {
        const profiles = await this.loadProfiles();
        const filtered = profiles.filter(p => p.name !== name);
        if (filtered.length === profiles.length) {
            return false; // Profile not found
        }
        await fs.writeFile(this.profileFile, JSON.stringify(filtered, null, 2));
        return true;
    }
    /**
     * Get a profile by name
     */
    async getProfile(name) {
        const profiles = await this.loadProfiles();
        return profiles.find(p => p.name === name) || null;
    }
    /**
     * Update last used timestamp for a profile
     */
    async markProfileUsed(name) {
        const profiles = await this.loadProfiles();
        const profile = profiles.find(p => p.name === name);
        if (profile) {
            profile.lastUsed = new Date().toISOString();
            await fs.writeFile(this.profileFile, JSON.stringify(profiles, null, 2));
        }
    }
    /**
     * Get default profiles
     */
    getDefaultProfiles() {
        return [
            {
                name: 'Home Network',
                description: 'Common home network subnets',
                options: {
                    subnets: ['192.168.1.0/24', '192.168.0.0/24', '192.168.4.0/24'],
                    ports: [80, 8080],
                    timeout: 5000,
                    concurrent: 20
                },
                createdAt: new Date().toISOString()
            },
            {
                name: 'AP Mode Only',
                description: 'ESP32 devices in access point mode',
                options: {
                    subnets: ['192.168.4.0/24'],
                    apModeIPs: ['192.168.4.1'],
                    ports: [80],
                    timeout: 3000,
                    concurrent: 5
                },
                createdAt: new Date().toISOString()
            },
            {
                name: 'Enterprise',
                description: 'Common enterprise network ranges',
                options: {
                    subnets: ['10.0.0.0/24', '10.1.1.0/24', '172.16.0.0/24'],
                    ports: [80, 8080, 8000],
                    timeout: 10000,
                    concurrent: 30
                },
                createdAt: new Date().toISOString()
            }
        ];
    }
}
//# sourceMappingURL=DiscoveryProfileManager.js.map