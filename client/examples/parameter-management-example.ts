#!/usr/bin/env tsx

/**
 * Comprehensive MAVLink Parameter Management Example
 * 
 * This example demonstrates how to use the MAVLinkParameterClient for:
 * - Parameter discovery and metadata
 * - Real-time parameter streaming via SSE
 * - Parameter validation and setting
 * - Parameter search and filtering
 * - Parameter backup and restore
 */

import { MAVLinkBridgeClient } from '../src/MAVLinkBridgeClient';
import {
  MAVLinkParameterClient,
  ParameterValidator,
  getParameterDefinition,
  searchParameters,
  getParametersByCategory,
  getParametersByUserLevel,
  ParameterChangeEvent,
  ParameterValue
} from '../src/mavlink/parameters';

class ParameterManagementDemo {
  private client: MAVLinkBridgeClient;
  private parameterClient: MAVLinkParameterClient;
  
  constructor(deviceUrl: string = 'http://192.168.4.1') {
    this.client = new MAVLinkBridgeClient(deviceUrl);
    this.parameterClient = this.client.parameters;
  }

  /**
   * Demonstrate parameter discovery and metadata usage
   */
  async demonstrateParameterDiscovery(): Promise<void> {
    console.log('\n🔍 Parameter Discovery and Metadata');
    console.log('=====================================');

    // Search for AHRS-related parameters
    const ahrsParams = searchParameters('AHRS');
    console.log(`\n📋 Found ${ahrsParams.length} AHRS-related parameters:`);
    
    ahrsParams.slice(0, 5).forEach(param => {
      console.log(`  • ${param.name}: ${param.displayName}`);
      console.log(`    ${param.description}`);
      console.log(`    Category: ${param.category}, Level: ${param.userLevel}`);
      if (param.range) {
        console.log(`    Range: ${param.range.min} - ${param.range.max} ${param.units || ''}`);
      }
      console.log('');
    });

    // Get parameters by category
    const batteryParams = getParametersByCategory('BATT');
    console.log(`\n🔋 Battery parameters: ${batteryParams.length} found`);
    
    batteryParams.slice(0, 3).forEach(param => {
      console.log(`  • ${param.name}: ${param.displayName}`);
    });

    // Get parameters by user level
    const standardParams = getParametersByUserLevel('Standard');
    console.log(`\n⭐ Standard user level parameters: ${standardParams.length} found`);
  }

  /**
   * Demonstrate parameter validation
   */
  async demonstrateParameterValidation(): Promise<void> {
    console.log('\n✅ Parameter Validation');
    console.log('=======================');

    // Test valid parameter
    const validResult = ParameterValidator.validateParameter('AHRS_GPS_GAIN', 1.5);
    console.log('\n✅ Valid parameter test:');
    console.log(`  AHRS_GPS_GAIN = 1.5: ${validResult.valid ? 'VALID' : 'INVALID'}`);
    if (validResult.warnings.length > 0) {
      console.log(`  Warnings: ${validResult.warnings.join(', ')}`);
    }

    // Test invalid parameter (out of range)
    const invalidResult = ParameterValidator.validateParameter('AHRS_GPS_GAIN', -5);
    console.log('\n❌ Invalid parameter test:');
    console.log(`  AHRS_GPS_GAIN = -5: ${invalidResult.valid ? 'VALID' : 'INVALID'}`);
    if (invalidResult.errors.length > 0) {
      console.log(`  Errors: ${invalidResult.errors.join(', ')}`);
    }

    // Test batch validation
    const batchParams = {
      'AHRS_GPS_GAIN': 1.0,
      'ARMING_CHECK': 1,
      'INVALID_PARAM': 999
    };
    
    console.log('\n📦 Batch validation:');
    const batchResults = ParameterValidator.validateParameters(batchParams);
    Object.entries(batchResults).forEach(([name, result]) => {
      console.log(`  ${name}: ${result.valid ? '✅' : '❌'}`);
      if (!result.valid) {
        console.log(`    Errors: ${result.errors.join(', ')}`);
      }
    });
  }

  /**
   * Demonstrate real-time parameter streaming
   */
  async demonstrateParameterStreaming(): Promise<void> {
    console.log('\n📡 Real-time Parameter Streaming');
    console.log('================================');

    // Set up parameter change listener
    const parameterChanges: ParameterChangeEvent[] = [];
    this.parameterClient.addParameterListener((event: ParameterChangeEvent) => {
      parameterChanges.push(event);
      console.log(`📢 Parameter ${event.type}: ${event.parameterName}`);
      if (event.oldValue !== undefined && event.newValue !== undefined) {
        console.log(`   ${event.oldValue} → ${event.newValue}`);
      }
    });

    try {
      // Start parameter stream
      console.log('\n🚀 Starting parameter stream...');
      await this.parameterClient.startParameterStream();
      
      // Request parameter list to populate cache
      console.log('📋 Requesting parameter list...');
      await this.parameterClient.requestParameterList();
      
      // Wait for some parameters to be received
      console.log('⏳ Waiting for parameters (10 seconds)...');
      await this.sleep(10000);
      
      // Show cache statistics
      const stats = this.parameterClient.getCacheStats();
      console.log('\n📊 Cache Statistics:');
      console.log(`  Total parameters: ${stats.totalParameters}`);
      console.log(`  Categories: ${Object.keys(stats.categoryCounts).length}`);
      console.log(`  User levels: Standard=${stats.userLevelCounts.Standard}, Advanced=${stats.userLevelCounts.Advanced}, Expert=${stats.userLevelCounts.Expert}`);
      console.log(`  Data types: int=${stats.dataTypeCounts.int}, float=${stats.dataTypeCounts.float}, enum=${stats.dataTypeCounts.enum}, bitmask=${stats.dataTypeCounts.bitmask}`);
      
    } finally {
      // Stop parameter stream
      this.parameterClient.stopParameterStream();
      console.log('🛑 Parameter stream stopped');
    }
  }

  /**
   * Demonstrate parameter reading and setting
   */
  async demonstrateParameterOperations(): Promise<void> {
    console.log('\n⚙️ Parameter Operations');
    console.log('=======================');

    try {
      // Request a specific parameter
      console.log('\n📤 Requesting parameter: AHRS_GPS_GAIN');
      const response = await this.parameterClient.requestParameter('AHRS_GPS_GAIN');
      console.log(`✅ Request sent: ${response.success}`);

      // Wait for parameter value
      console.log('⏳ Waiting for parameter value...');
      try {
        const parameter = await this.parameterClient.waitForParameter('AHRS_GPS_GAIN', 5000);
        console.log(`📄 Received: ${parameter.name} = ${parameter.value}`);
        
        const definition = getParameterDefinition(parameter.name);
        if (definition) {
          console.log(`   Description: ${definition.description}`);
          console.log(`   Units: ${definition.units || 'none'}`);
        }
      } catch (error) {
        console.log(`❌ Timeout waiting for parameter: ${error}`);
      }

      // Demonstrate parameter setting (careful - this modifies the FC!)
      console.log('\n⚠️ Parameter setting demonstration (commented out for safety)');
      console.log('// To actually set a parameter, uncomment the following:');
      console.log('// await this.parameterClient.setParameter("AHRS_GPS_GAIN", 1.0);');

    } catch (error) {
      console.error('❌ Parameter operation error:', error);
    }
  }

  /**
   * Demonstrate parameter search and filtering
   */
  async demonstrateParameterSearch(): Promise<void> {
    console.log('\n🔎 Parameter Search and Filtering');
    console.log('=================================');

    // Search cached parameters
    const searchResults = this.parameterClient.searchCachedParameters({
      query: 'GPS',
      userLevels: ['Standard', 'Advanced'],
      limit: 5
    });

    console.log(`\n🔍 Search results for "GPS" (${searchResults.totalCount} total, showing ${searchResults.parameters.length}):`);
    searchResults.parameters.forEach(param => {
      const def = getParameterDefinition(param.name);
      console.log(`  • ${param.name} = ${param.value}`);
      if (def) {
        console.log(`    ${def.displayName}: ${def.description.substring(0, 60)}...`);
      }
    });

    // Filter by category
    const ahrsResults = this.parameterClient.searchCachedParameters({
      categories: ['AHRS'],
      limit: 3
    });

    console.log(`\n🧭 AHRS category parameters (${ahrsResults.totalCount} total):`);
    ahrsResults.parameters.forEach(param => {
      console.log(`  • ${param.name} = ${param.value}`);
    });
  }

  /**
   * Demonstrate parameter backup functionality
   */
  async demonstrateParameterBackup(): Promise<void> {
    console.log('\n💾 Parameter Backup');
    console.log('===================');

    const allParams = this.parameterClient.getAllCachedParameters();
    if (allParams.length === 0) {
      console.log('⚠️ No parameters in cache. Run streaming demo first.');
      return;
    }

    // Create a parameter backup
    const backup = {
      timestamp: Date.now(),
      parameters: {} as Record<string, number>
    };

    allParams.forEach(param => {
      backup.parameters[param.name] = param.value;
    });

    console.log(`📦 Created backup with ${Object.keys(backup.parameters).length} parameters`);
    console.log(`📅 Backup timestamp: ${new Date(backup.timestamp).toISOString()}`);

    // Calculate backup checksum
    const checksum = this.calculateSimpleChecksum(JSON.stringify(backup.parameters));
    console.log(`🔐 Backup checksum: ${checksum}`);

    // Show sample of backed up parameters
    const sampleParams = Object.entries(backup.parameters).slice(0, 5);
    console.log('\n📋 Sample parameters in backup:');
    sampleParams.forEach(([name, value]) => {
      console.log(`  ${name} = ${value}`);
    });
  }

  /**
   * Run all demonstrations
   */
  async runDemo(): Promise<void> {
    console.log('🚀 MAVLink Parameter Management Demo');
    console.log('===================================');

    try {
      await this.demonstrateParameterDiscovery();
      await this.demonstrateParameterValidation();
      await this.demonstrateParameterStreaming();
      await this.demonstrateParameterOperations();
      await this.demonstrateParameterSearch();
      await this.demonstrateParameterBackup();

      console.log('\n✅ Demo completed successfully!');
      console.log('\nNext steps:');
      console.log('• Connect to a real flight controller to see live parameter data');
      console.log('• Explore the parameter browser example for a UI implementation');
      console.log('• Check the API specification for additional endpoints');

    } catch (error) {
      console.error('❌ Demo failed:', error);
    } finally {
      // Cleanup
      this.parameterClient.destroy();
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private calculateSimpleChecksum(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }
}

// Run the demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const demo = new ParameterManagementDemo();
  demo.runDemo().catch(console.error);
}

export { ParameterManagementDemo };