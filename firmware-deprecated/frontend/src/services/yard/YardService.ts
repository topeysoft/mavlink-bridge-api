import type { AxiosInstance } from 'axios';
import { apiClient } from '../api/client';
import type {
    Yard,
    YardZone,
    Obstacle,
    MowingPath,
    WeatherData,
    MowingSchedule,
    MapSettings
} from '../types/yard.types';
import type { ApiResponse, PaginatedResponse } from '../api/client';

export class YardService {
    private client: AxiosInstance;

    constructor(client: AxiosInstance = apiClient) {
        this.client = client;
    }

    // Yard Management
    async getYards (): Promise<Yard[]> {
        const response = await this.client.get<ApiResponse<Yard[]>>('/yards');
        return response.data.data || response.data;
    }

    async getYard (yardId: string): Promise<Yard> {
        const response = await this.client.get<ApiResponse<Yard>>(`/yards/${yardId}`);
        return response.data.data || response.data;
    }

    async createYard (yardData: Omit<Yard, 'id' | 'createdAt' | 'updatedAt' | 'ownerId'>): Promise<Yard> {
        const response = await this.client.post<ApiResponse<Yard>>('/yards', yardData);
        return response.data.data || response.data;
    }

    async updateYard (yardId: string, updates: Partial<Yard>): Promise<Yard> {
        const response = await this.client.put<ApiResponse<Yard>>(`/yards/${yardId}`, updates);
        return response.data.data || response.data;
    }

    async deleteYard (yardId: string): Promise<void> {
        await this.client.delete(`/yards/${yardId}`);
    }

    // Zone Management
    async getZones (yardId: string): Promise<YardZone[]> {
        const response = await this.client.get<ApiResponse<YardZone[]>>(`/yards/${yardId}/zones`);
        return response.data.data || response.data;
    }

    async createZone (yardId: string, zoneData: Omit<YardZone, 'id'>): Promise<YardZone> {
        const response = await this.client.post<ApiResponse<YardZone>>(`/yards/${yardId}/zones`, zoneData);
        return response.data.data || response.data;
    }

    async updateZone (zoneId: string, updates: Partial<YardZone>): Promise<YardZone> {
        const response = await this.client.put<ApiResponse<YardZone>>(`/zones/${zoneId}`, updates);
        return response.data.data || response.data;
    }

    async deleteZone (zoneId: string): Promise<void> {
        await this.client.delete(`/zones/${zoneId}`);
    }

    async toggleZoneActive (zoneId: string, active: boolean): Promise<YardZone> {
        const response = await this.client.patch<ApiResponse<YardZone>>(`/zones/${zoneId}/active`, { active });
        return response.data.data || response.data;
    }

    // Obstacle Management
    async getObstacles (yardId: string): Promise<Obstacle[]> {
        const response = await this.client.get<ApiResponse<Obstacle[]>>(`/yards/${yardId}/obstacles`);
        return response.data.data || response.data;
    }

    async createObstacle (yardId: string, obstacleData: Omit<Obstacle, 'id'>): Promise<Obstacle> {
        const response = await this.client.post<ApiResponse<Obstacle>>(`/yards/${yardId}/obstacles`, obstacleData);
        return response.data.data || response.data;
    }

    async updateObstacle (obstacleId: string, updates: Partial<Obstacle>): Promise<Obstacle> {
        const response = await this.client.put<ApiResponse<Obstacle>>(`/obstacles/${obstacleId}`, updates);
        return response.data.data || response.data;
    }

    async deleteObstacle (obstacleId: string): Promise<void> {
        await this.client.delete(`/obstacles/${obstacleId}`);
    }

    async toggleObstacleActive (obstacleId: string, active: boolean): Promise<Obstacle> {
        const response = await this.client.patch<ApiResponse<Obstacle>>(`/obstacles/${obstacleId}/active`, { active });
        return response.data.data || response.data;
    }

    // Mowing Paths
    async getMowingPaths (yardId: string, page = 1, limit = 20): Promise<PaginatedResponse<MowingPath>> {
        const response = await this.client.get<PaginatedResponse<MowingPath>>(
            `/yards/${yardId}/paths?page=${page}&limit=${limit}`
        );
        return response.data;
    }

    async getMowingPath (pathId: string): Promise<MowingPath> {
        const response = await this.client.get<ApiResponse<MowingPath>>(`/paths/${pathId}`);
        return response.data.data || response.data;
    }

    async deleteMowingPath (pathId: string): Promise<void> {
        await this.client.delete(`/paths/${pathId}`);
    }

    async getRecentPaths (yardId: string, hours = 24): Promise<MowingPath[]> {
        const response = await this.client.get<ApiResponse<MowingPath[]>>(
            `/yards/${yardId}/paths/recent?hours=${hours}`
        );
        return response.data.data || response.data;
    }

    // Weather Integration
    async getWeather (yardId: string): Promise<WeatherData> {
        const response = await this.client.get<ApiResponse<WeatherData>>(`/yards/${yardId}/weather`);
        return response.data.data || response.data;
    }

    async getWeatherForecast (yardId: string, days = 7): Promise<WeatherData['forecast']> {
        const response = await this.client.get<ApiResponse<WeatherData['forecast']>>(
            `/yards/${yardId}/weather/forecast?days=${days}`
        );
        return response.data.data || response.data;
    }

    async checkMowingConditions (yardId: string): Promise<{
        suitable: boolean;
        reasons: string[];
        recommendation: 'proceed' | 'wait' | 'postpone';
        nextSuitableTime?: string;
    }> {
        const response = await this.client.get(`/yards/${yardId}/weather/mowing-conditions`);
        return response.data.data || response.data;
    }

    // Scheduling
    async getSchedules (yardId: string): Promise<MowingSchedule[]> {
        const response = await this.client.get<ApiResponse<MowingSchedule[]>>(`/yards/${yardId}/schedules`);
        return response.data.data || response.data;
    }

    async createSchedule (yardId: string, scheduleData: Omit<MowingSchedule, 'id' | 'yardId' | 'createdAt' | 'updatedAt'>): Promise<MowingSchedule> {
        const response = await this.client.post<ApiResponse<MowingSchedule>>(`/yards/${yardId}/schedules`, scheduleData);
        return response.data.data || response.data;
    }

    async updateSchedule (scheduleId: string, updates: Partial<MowingSchedule>): Promise<MowingSchedule> {
        const response = await this.client.put<ApiResponse<MowingSchedule>>(`/schedules/${scheduleId}`, updates);
        return response.data.data || response.data;
    }

    async deleteSchedule (scheduleId: string): Promise<void> {
        await this.client.delete(`/schedules/${scheduleId}`);
    }

    async toggleScheduleActive (scheduleId: string, active: boolean): Promise<MowingSchedule> {
        const response = await this.client.patch<ApiResponse<MowingSchedule>>(`/schedules/${scheduleId}/active`, { active });
        return response.data.data || response.data;
    }

    async getNextScheduledRuns (yardId: string, days = 7): Promise<Array<{
        scheduleId: string;
        scheduleName: string;
        runTime: string;
        zones: string[];
        estimatedDuration: number;
    }>> {
        const response = await this.client.get(`/yards/${yardId}/schedules/upcoming?days=${days}`);
        return response.data.data || response.data;
    }

    // Map Settings
    async getMapSettings (yardId: string): Promise<MapSettings> {
        const response = await this.client.get<ApiResponse<MapSettings>>(`/yards/${yardId}/map-settings`);
        return response.data.data || response.data;
    }

    async updateMapSettings (yardId: string, settings: Partial<MapSettings>): Promise<MapSettings> {
        const response = await this.client.put<ApiResponse<MapSettings>>(`/yards/${yardId}/map-settings`, settings);
        return response.data.data || response.data;
    }

    // Analytics
    async getYardStats (yardId: string, period = '30d'): Promise<{
        totalArea: number;
        areaMowed: number;
        averageMowingTime: number;
        mostActiveZone: string;
        weatherImpactDays: number;
        efficiency: number;
        coverageMap: Array<{
            latitude: number;
            longitude: number;
            coverage: number; // 0-100
        }>;
    }> {
        const response = await this.client.get(`/yards/${yardId}/stats?period=${period}`);
        return response.data.data || response.data;
    }

    async getZoneStats (zoneId: string, period = '30d'): Promise<{
        area: number;
        timesMowed: number;
        averageDuration: number;
        lastMowed: string;
        nextScheduled?: string;
        efficiency: number;
    }> {
        const response = await this.client.get(`/zones/${zoneId}/stats?period=${period}`);
        return response.data.data || response.data;
    }

    // Route Planning
    async calculateOptimalRoute (yardId: string, options: {
        zones?: string[];
        pattern?: 'random' | 'spiral' | 'lines' | 'perimeter';
        startLocation?: {
            latitude: number;
            longitude: number;
        };
        avoidObstacles?: boolean;
        weatherOptimized?: boolean;
    }): Promise<{
        route: Array<{
            latitude: number;
            longitude: number;
            action: 'move' | 'mow' | 'turn' | 'return';
        }>;
        estimatedDuration: number;
        estimatedDistance: number;
        batteryRequired: number;
    }> {
        const response = await this.client.post(`/yards/${yardId}/route/calculate`, options);
        return response.data.data || response.data;
    }

    // Boundary Management
    async validateBoundaries (yardId: string): Promise<{
        valid: boolean;
        issues: Array<{
            type: 'self_intersection' | 'too_small' | 'open_boundary' | 'overlapping_zones';
            description: string;
            location?: {
                latitude: number;
                longitude: number;
            };
        }>;
    }> {
        const response = await this.client.post(`/yards/${yardId}/boundaries/validate`);
        return response.data.data || response.data;
    }

    async autoDetectBoundaries (yardId: string, satelliteImage?: string): Promise<{
        suggestedBoundaries: Array<{
            latitude: number;
            longitude: number;
        }>;
        confidence: number;
        detectedFeatures: Array<{
            type: 'lawn' | 'trees' | 'building' | 'path' | 'water';
            boundaries: Array<{
                latitude: number;
                longitude: number;
            }>;
        }>;
    }> {
        const response = await this.client.post(`/yards/${yardId}/boundaries/auto-detect`, {
            satelliteImage,
        });
        return response.data.data || response.data;
    }
}

// Export singleton instance
export const yardService = new YardService();
