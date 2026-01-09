import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import type { DiscoveryOptions } from '@mavlinkbridge/api-client';

export interface DiscoveryProfile {
  name: string;
  description?: string;
  options: DiscoveryOptions;
  createdAt: string;
  lastUsed?: string;
}

export class DiscoveryProfileManager {
  private profileDir: string;
  private profileFile: string;

  constructor() {
    // Store profiles in user's home directory
    this.profileDir = path.join(os.homedir(), '.yardrover');
    this.profileFile = path.join(this.profileDir, 'discovery-profiles.json');
  }

  /**
   * Ensure the profile directory exists
   */
  private async ensureProfileDir(): Promise<void> {
    try {
      await fs.mkdir(this.profileDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create profile directory:', error);
    }
  }

  /**
   * Load all saved profiles
   */
  public async loadProfiles(): Promise<DiscoveryProfile[]> {
    try {
      await this.ensureProfileDir();
      const data = await fs.readFile(this.profileFile, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      // Return empty array if file doesn't exist or is corrupted
      return [];
    }
  }

  /**
   * Save a new profile
   */
  public async saveProfile(profile: Omit<DiscoveryProfile, 'createdAt'>): Promise<void> {
    await this.ensureProfileDir();
    
    const profiles = await this.loadProfiles();
    
    // Check if profile with same name exists
    const existingIndex = profiles.findIndex(p => p.name === profile.name);
    
    const newProfile: DiscoveryProfile = {
      ...profile,
      createdAt: existingIndex >= 0 ? profiles[existingIndex].createdAt : new Date().toISOString(),
      lastUsed: new Date().toISOString()
    };
    
    if (existingIndex >= 0) {
      // Update existing profile
      profiles[existingIndex] = newProfile;
    } else {
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
  public async deleteProfile(name: string): Promise<boolean> {
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
  public async getProfile(name: string): Promise<DiscoveryProfile | null> {
    const profiles = await this.loadProfiles();
    return profiles.find(p => p.name === name) || null;
  }

  /**
   * Update last used timestamp for a profile
   */
  public async markProfileUsed(name: string): Promise<void> {
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
  public getDefaultProfiles(): DiscoveryProfile[] {
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