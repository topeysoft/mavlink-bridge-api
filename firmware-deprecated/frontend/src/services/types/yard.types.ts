// Yard-related TypeScript interfaces
export interface Yard {
    id: string;
    name: string;
    description?: string;
    address: {
        street: string;
        city: string;
        state: string;
        zipCode: string;
        country: string;
    };
    coordinates: {
        latitude: number;
        longitude: number;
    };
    boundaries: Array<{
        latitude: number;
        longitude: number;
    }>;
    area: number; // square meters
    zones: YardZone[];
    obstacles: Obstacle[];
    chargingStation: {
        latitude: number;
        longitude: number;
        name: string;
    };
    weather: WeatherData;
    createdAt: string;
    updatedAt: string;
    ownerId: string;
}

export interface YardZone {
    id: string;
    name: string;
    type: 'mowing' | 'no_mow' | 'slow_mow' | 'flower_bed' | 'trees' | 'path' | 'water';
    priority: 'low' | 'medium' | 'high';
    boundaries: Array<{
        latitude: number;
        longitude: number;
    }>;
    area: number; // square meters
    mowingHeight?: number; // cm
    mowingFrequency?: number; // days
    lastMowed?: string; // ISO date
    color: string; // hex color for map display
    active: boolean;
}

export interface Obstacle {
    id: string;
    name: string;
    type: 'permanent' | 'temporary' | 'seasonal';
    category: 'tree' | 'fence' | 'building' | 'pool' | 'garden' | 'furniture' | 'slope' | 'other';
    location: {
        latitude: number;
        longitude: number;
    };
    size?: {
        width: number; // meters
        length: number; // meters
        height?: number; // meters
    };
    shape: 'circle' | 'rectangle' | 'polygon' | 'point';
    coordinates: Array<{
        latitude: number;
        longitude: number;
    }>;
    avoidanceDistance: number; // meters
    active: boolean;
    seasonal?: {
        startDate: string; // MM-DD
        endDate: string; // MM-DD
    };
    notes?: string;
}

export interface MowingPath {
    id: string;
    name: string;
    yardId: string;
    zoneId?: string;
    points: Array<{
        latitude: number;
        longitude: number;
        timestamp: string;
        heading: number; // degrees
        speed: number; // km/h
    }>;
    distance: number; // meters
    duration: number; // minutes
    efficiency: number; // percentage
    pattern: 'random' | 'spiral' | 'lines' | 'perimeter' | 'zones';
    createdAt: string;
    machineId: string;
}

export interface WeatherData {
    current: {
        temperature: number; // Celsius
        humidity: number; // percentage
        precipitation: number; // mm/hr
        windSpeed: number; // km/h
        windDirection: number; // degrees
        uvIndex: number;
        visibility: number; // km
        pressure: number; // hPa
        conditions: 'sunny' | 'cloudy' | 'rainy' | 'snowy' | 'stormy' | 'foggy';
        timestamp: string;
    };
    forecast: Array<{
        date: string; // YYYY-MM-DD
        temperatureHigh: number;
        temperatureLow: number;
        precipitation: number; // mm
        precipitationChance: number; // percentage
        windSpeed: number; // km/h
        conditions: string;
        suitable: boolean; // for mowing
    }>;
    alerts?: Array<{
        type: 'storm' | 'rain' | 'wind' | 'temperature';
        severity: 'minor' | 'moderate' | 'severe' | 'extreme';
        message: string;
        startTime: string;
        endTime: string;
    }>;
}

export interface MowingSchedule {
    id: string;
    name: string;
    yardId: string;
    zones: string[]; // zone IDs
    frequency: 'daily' | 'weekly' | 'monthly' | 'custom';
    days: number[]; // 0-6, Sunday to Saturday
    startTime: string; // HH:MM
    duration?: number; // minutes
    conditions: {
        minTemperature?: number;
        maxTemperature?: number;
        maxWindSpeed?: number;
        maxPrecipitation?: number;
        requiresSunlight?: boolean;
    };
    active: boolean;
    lastRun?: string;
    nextRun?: string;
    createdAt: string;
    updatedAt: string;
}

export interface MapSettings {
    defaultZoom: number;
    mapType: 'satellite' | 'terrain' | 'hybrid' | 'roadmap';
    showZones: boolean;
    showObstacles: boolean;
    showPaths: boolean;
    showMachine: boolean;
    showWeather: boolean;
    autoCenter: boolean;
    trackMachine: boolean;
    pathHistory: number; // days
}
