#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ArduPilotParameterDefinition {
  [groupName: string]: {
    [paramName: string]: {
      Description: string;
      DisplayName: string;
      Range?: {
        high: number;
        low: number;
      };
      Units?: string;
      User?: string; // Standard, Advanced, etc.
      Values?: {
        [value: string]: string;
      };
      Bitmask?: {
        [bit: string]: string;
      };
      Increment?: number;
      RebootRequired?: boolean;
    };
  };
}

interface ProcessedParameterDefinition {
  name: string;
  displayName: string;
  description: string;
  group: string;
  category: string;
  userLevel: 'Standard' | 'Advanced' | 'Expert';
  dataType: 'int' | 'float' | 'enum' | 'bitmask';
  range?: {
    min: number;
    max: number;
  };
  units?: string;
  increment?: number;
  values?: Record<string, string>;
  bitmask?: Record<string, string>;
  rebootRequired?: boolean;
  tags: string[];
}

interface ParameterCategory {
  name: string;
  displayName: string;
  description: string;
  icon?: string;
  parameters: string[];
  subcategories: string[];
}

class ParameterDefinitionProcessor {
  private readonly ARDUPILOT_PARAM_URL = 'https://autotest.ardupilot.org/Parameters/Rover/apm.pdef.json';
  
  private readonly CATEGORY_MAPPING: Record<string, ParameterCategory> = {
    'AHRS': {
      name: 'ahrs',
      displayName: 'AHRS (Attitude Heading Reference System)',
      description: 'Attitude and heading estimation parameters',
      icon: 'compass',
      parameters: [],
      subcategories: []
    },
    'ARMING': {
      name: 'arming',
      displayName: 'Arming & Safety',
      description: 'Vehicle arming and safety check parameters',
      icon: 'shield',
      parameters: [],
      subcategories: []
    },
    'BATT': {
      name: 'battery',
      displayName: 'Battery Management',
      description: 'Battery monitoring and failsafe parameters',
      icon: 'battery',
      parameters: [],
      subcategories: []
    },
    'COMPASS': {
      name: 'compass',
      displayName: 'Compass',
      description: 'Magnetometer calibration and configuration',
      icon: 'compass',
      parameters: [],
      subcategories: []
    },
    'EK2': {
      name: 'ekf2',
      displayName: 'Extended Kalman Filter 2',
      description: 'EKF2 state estimation parameters',
      icon: 'filter',
      parameters: [],
      subcategories: []
    },
    'EK3': {
      name: 'ekf3',
      displayName: 'Extended Kalman Filter 3',
      description: 'EKF3 state estimation parameters',
      icon: 'filter',
      parameters: [],
      subcategories: []
    },
    'FENC': {
      name: 'fence',
      displayName: 'Geofence',
      description: 'Geofence boundary and action parameters',
      icon: 'fence',
      parameters: [],
      subcategories: []
    },
    'GPS': {
      name: 'gps',
      displayName: 'GPS/GNSS',
      description: 'Global positioning system configuration',
      icon: 'satellite',
      parameters: [],
      subcategories: []
    },
    'INS': {
      name: 'ins',
      displayName: 'Inertial Navigation',
      description: 'IMU and inertial navigation parameters',
      icon: 'gyroscope',
      parameters: [],
      subcategories: []
    },
    'LOG': {
      name: 'logging',
      displayName: 'Data Logging',
      description: 'Flight data logging configuration',
      icon: 'log',
      parameters: [],
      subcategories: []
    },
    'MOT': {
      name: 'motor',
      displayName: 'Motor Control',
      description: 'Motor and servo control parameters',
      icon: 'motor',
      parameters: [],
      subcategories: []
    },
    'NAVL1': {
      name: 'navigation',
      displayName: 'Navigation',
      description: 'Path planning and navigation parameters',
      icon: 'navigation',
      parameters: [],
      subcategories: []
    },
    'NTF': {
      name: 'notification',
      displayName: 'Notifications',
      description: 'LED and buzzer notification settings',
      icon: 'bell',
      parameters: [],
      subcategories: []
    },
    'RNGFND': {
      name: 'rangefinder',
      displayName: 'Range Finder',
      description: 'Distance sensor configuration',
      icon: 'ruler',
      parameters: [],
      subcategories: []
    },
    'SERIAL': {
      name: 'serial',
      displayName: 'Serial Ports',
      description: 'UART serial port configuration',
      icon: 'port',
      parameters: [],
      subcategories: []
    },
    'SERVO': {
      name: 'servo',
      displayName: 'Servo Outputs',
      description: 'Servo output channel configuration',
      icon: 'servo',
      parameters: [],
      subcategories: []
    },
    'SR0': {
      name: 'telemetry',
      displayName: 'Telemetry',
      description: 'Telemetry stream configuration',
      icon: 'radio',
      parameters: [],
      subcategories: []
    },
    'WPNAV': {
      name: 'waypoint',
      displayName: 'Waypoint Navigation',
      description: 'Waypoint navigation parameters',
      icon: 'waypoint',
      parameters: [],
      subcategories: []
    }
  };

  async fetchParameterDefinitions(): Promise<ArduPilotParameterDefinition> {
    return new Promise((resolve, reject) => {
      console.log(`🌐 Fetching from: ${this.ARDUPILOT_PARAM_URL}`);
      
      https.get(this.ARDUPILOT_PARAM_URL, (response) => {
        console.log(`📡 Response status: ${response.statusCode}`);
        console.log(`📋 Response headers:`, response.headers);
        
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          if (response.headers.location) {
            console.log(`🔄 Redirecting to: ${response.headers.location}`);
            https.get(response.headers.location, (redirectResponse) => {
              let data = '';
              redirectResponse.on('data', (chunk) => data += chunk);
              redirectResponse.on('end', () => {
                try {
                  const parsed = JSON.parse(data);
                  resolve(parsed);
                } catch (error) {
                  console.error(`❌ JSON Parse Error. First 200 chars of response:`);
                  console.error(data.substring(0, 200));
                  reject(new Error(`Failed to parse parameter definitions: ${error}`));
                }
              });
            }).on('error', reject);
          } else {
            reject(new Error('Redirect without location header'));
          }
          return;
        }
        
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }
        
        let data = '';
        response.on('data', (chunk) => data += chunk);
        response.on('end', () => {
          console.log(`📄 Received ${data.length} bytes`);
          console.log(`🔍 Content type: ${response.headers['content-type']}`);
          
          // Check if we got HTML instead of JSON
          if (data.trim().startsWith('<')) {
            console.error(`❌ Received HTML instead of JSON. First 200 chars:`);
            console.error(data.substring(0, 200));
            reject(new Error('Received HTML content instead of JSON'));
            return;
          }
          
          try {
            const parsed = JSON.parse(data);
            console.log(`✅ Successfully parsed JSON with ${Object.keys(parsed).length} parameter groups`);
            resolve(parsed);
          } catch (error) {
            console.error(`❌ JSON Parse Error. First 200 chars of response:`);
            console.error(data.substring(0, 200));
            reject(new Error(`Failed to parse parameter definitions: ${error}`));
          }
        });
      }).on('error', (error) => {
        console.error(`❌ Network error:`, error);
        reject(error);
      });
    });
  }

  processParameterDefinitions(raw: ArduPilotParameterDefinition): ProcessedParameterDefinition[] {
    const processed: ProcessedParameterDefinition[] = [];

    for (const [groupName, groupParams] of Object.entries(raw)) {
      for (const [paramName, paramDef] of Object.entries(groupParams)) {
        const category = this.determineCategory(paramName);
        const dataType = this.determineDataType(paramDef);
        const userLevel = this.mapUserLevel(paramDef.User);

        const processedParam: ProcessedParameterDefinition = {
          name: paramName,
          displayName: paramDef.DisplayName || paramName,
          description: paramDef.Description || '',
          group: groupName,
          category,
          userLevel,
          dataType,
          units: paramDef.Units,
          increment: paramDef.Increment ? Number(paramDef.Increment) : undefined,
          values: paramDef.Values,
          bitmask: paramDef.Bitmask,
          rebootRequired: Boolean(paramDef.RebootRequired),
          tags: this.generateTags(paramName, paramDef),
        };

        if (paramDef.Range) {
          processedParam.range = {
            min: Number(paramDef.Range.low),
            max: Number(paramDef.Range.high),
          };
        }

        processed.push(processedParam);

        // Update category parameter lists
        if (this.CATEGORY_MAPPING[category]) {
          this.CATEGORY_MAPPING[category].parameters.push(paramName);
        }
      }
    }

    return processed;
  }

  private determineCategory(paramName: string): string {
    const prefix = paramName.split('_')[0];
    return this.CATEGORY_MAPPING[prefix] ? prefix : 'MISC';
  }

  private determineDataType(paramDef: any): 'int' | 'float' | 'enum' | 'bitmask' {
    if (paramDef.Bitmask) return 'bitmask';
    if (paramDef.Values) return 'enum';
    if (paramDef.Increment && paramDef.Increment % 1 !== 0) return 'float';
    if (paramDef.Range && (paramDef.Range.low % 1 !== 0 || paramDef.Range.high % 1 !== 0)) return 'float';
    return 'int';
  }

  private mapUserLevel(userLevel?: string): 'Standard' | 'Advanced' | 'Expert' {
    switch (userLevel) {
      case 'Standard': return 'Standard';
      case 'Advanced': return 'Advanced';
      default: return 'Expert';
    }
  }

  private generateTags(paramName: string, paramDef: any): string[] {
    const tags: string[] = [];
    
    // Add prefix as tag
    const prefix = paramName.split('_')[0];
    tags.push(prefix.toLowerCase());
    
    // Add functional tags based on description
    const description = paramDef.Description?.toLowerCase() || '';
    if (description.includes('enable')) tags.push('enable');
    if (description.includes('threshold')) tags.push('threshold');
    if (description.includes('limit')) tags.push('limit');
    if (description.includes('timeout')) tags.push('timeout');
    if (description.includes('gain')) tags.push('gain');
    if (description.includes('pid')) tags.push('pid');
    if (description.includes('filter')) tags.push('filter');
    if (description.includes('calibration')) tags.push('calibration');
    
    // Add data type tags
    if (paramDef.Values) tags.push('enum');
    if (paramDef.Bitmask) tags.push('bitmask');
    if (paramDef.RebootRequired) tags.push('reboot-required');
    
    return tags;
  }

  generateTypeScriptDefinitions(parameters: ProcessedParameterDefinition[]): string {
    const categories = Object.values(this.CATEGORY_MAPPING);
    
    return `// Generated parameter definitions from ArduPilot
// DO NOT EDIT - This file is auto-generated by scripts/fetch-parameter-definitions.ts

export interface ParameterDefinition {
  name: string;
  displayName: string;
  description: string;
  group: string;
  category: string;
  userLevel: 'Standard' | 'Advanced' | 'Expert';
  dataType: 'int' | 'float' | 'enum' | 'bitmask';
  range?: {
    min: number;
    max: number;
  };
  units?: string;
  increment?: number;
  values?: Record<string, string>;
  bitmask?: Record<string, string>;
  rebootRequired: boolean;
  tags: string[];
}

export interface ParameterCategory {
  name: string;
  displayName: string;
  description: string;
  icon?: string;
  parameters: string[];
  subcategories: string[];
}

export const PARAMETER_DEFINITIONS: Record<string, ParameterDefinition> = {
${parameters.map(p => `  "${p.name}": ${JSON.stringify(p, null, 4).split('\n').join('\n  ')}`).join(',\n')}
};

export const PARAMETER_CATEGORIES: Record<string, ParameterCategory> = {
${categories.map(c => `  "${c.name}": ${JSON.stringify(c, null, 4).split('\n').join('\n  ')}`).join(',\n')}
};

export const PARAMETER_NAMES = Object.keys(PARAMETER_DEFINITIONS);

export const CATEGORY_NAMES = Object.keys(PARAMETER_CATEGORIES);

export function getParameterDefinition(name: string): ParameterDefinition | undefined {
  return PARAMETER_DEFINITIONS[name];
}

export function getParametersByCategory(category: string): ParameterDefinition[] {
  return Object.values(PARAMETER_DEFINITIONS).filter(p => p.category === category);
}

export function searchParameters(query: string): ParameterDefinition[] {
  const lowerQuery = query.toLowerCase();
  return Object.values(PARAMETER_DEFINITIONS).filter(p => 
    p.name.toLowerCase().includes(lowerQuery) ||
    p.displayName.toLowerCase().includes(lowerQuery) ||
    p.description.toLowerCase().includes(lowerQuery) ||
    p.tags.some(tag => tag.includes(lowerQuery))
  );
}

export function getParametersByUserLevel(level: 'Standard' | 'Advanced' | 'Expert'): ParameterDefinition[] {
  const levels = level === 'Standard' ? ['Standard'] : 
                level === 'Advanced' ? ['Standard', 'Advanced'] :
                ['Standard', 'Advanced', 'Expert'];
  
  return Object.values(PARAMETER_DEFINITIONS).filter(p => levels.includes(p.userLevel));
}

// Parameter validation utilities
export function validateParameterValue(paramName: string, value: any): { valid: boolean; error?: string } {
  const def = getParameterDefinition(paramName);
  if (!def) {
    return { valid: false, error: 'Parameter not found' };
  }

  // Type validation
  if (def.dataType === 'int' && !Number.isInteger(Number(value))) {
    return { valid: false, error: 'Value must be an integer' };
  }

  if (def.dataType === 'float' && isNaN(Number(value))) {
    return { valid: false, error: 'Value must be a number' };
  }

  // Range validation
  if (def.range) {
    const numValue = Number(value);
    if (numValue < def.range.min || numValue > def.range.max) {
      return { valid: false, error: \`Value must be between \${def.range.min} and \${def.range.max}\` };
    }
  }

  // Enum validation
  if (def.values && !Object.keys(def.values).includes(String(value))) {
    return { valid: false, error: \`Value must be one of: \${Object.keys(def.values).join(', ')}\` };
  }

  return { valid: true };
}
`;
  }

  async generateDefinitions(): Promise<void> {
    try {
      console.log('🔄 Fetching ArduPilot parameter definitions...');
      const rawDefinitions = await this.fetchParameterDefinitions();
      
      console.log('📊 Processing parameter definitions...');
      const processedDefinitions = this.processParameterDefinitions(rawDefinitions);
      
      console.log(`✅ Processed ${processedDefinitions.length} parameters`);
      
      console.log('📝 Generating TypeScript definitions...');
      const tsDefinitions = this.generateTypeScriptDefinitions(processedDefinitions);
      
      // Ensure output directory exists
      const outputDir = path.join(__dirname, '..', 'src', 'mavlink', 'parameters');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      // Write the generated TypeScript file
      const outputPath = path.join(outputDir, 'ParameterDefinitions.ts');
      fs.writeFileSync(outputPath, tsDefinitions);
      
      console.log(`✅ Generated parameter definitions: ${outputPath}`);
      
      // Also write raw JSON for debugging/inspection
      const jsonPath = path.join(outputDir, 'raw-definitions.json');
      fs.writeFileSync(jsonPath, JSON.stringify(processedDefinitions, null, 2));
      
      console.log(`📄 Saved raw definitions: ${jsonPath}`);
      console.log(`🎉 Parameter definition generation complete!`);
      
    } catch (error) {
      console.error('❌ Error generating parameter definitions:', error);
      process.exit(1);
    }
  }
}

// Run the script if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const processor = new ParameterDefinitionProcessor();
  processor.generateDefinitions();
}

export { ParameterDefinitionProcessor };