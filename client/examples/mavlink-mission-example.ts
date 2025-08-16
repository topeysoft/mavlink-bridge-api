import { MAVLinkBridgeClient } from '../src/MAVLinkBridgeClient';
import { MissionItem, MAVFrame, MAVMissionType } from '../src/mavlink/MAVLinkMissionTypes';

async function missionExample() {
  // Create client instance
  const client = new MAVLinkBridgeClient('http://192.168.4.1');

  try {
    // Connect to the device
    await client.connect();
    console.log('Connected to MAVLink Bridge');

    // Example 1: Create and upload a simple mission
    console.log('\n=== Creating Mission ===');
    
    const missionItems: MissionItem[] = [
      // Takeoff to 10m
      client.mission.createTakeoffItem(47.6097, -122.3331, 10, 0),
      
      // Waypoint 1
      client.mission.createWaypoint({
        lat: 47.6098,
        lng: -122.3332,
        alt: 10,
        seq: 1
      }),
      
      // Waypoint 2 with loiter
      client.mission.createLoiterItem(47.6099, -122.3333, 10, 20, 30, 2),
      
      // Return to launch
      client.mission.createReturnToLaunchItem(3)
    ];

    console.log(`Created mission with ${missionItems.length} items`);

    // Upload mission
    console.log('\n=== Uploading Mission ===');
    const uploadResult = await client.mission.uploadMission({
      items: missionItems
    });

    if (uploadResult.success) {
      console.log(`Mission uploaded successfully: ${uploadResult.itemsProcessed}/${uploadResult.totalItems} items`);
    } else {
      console.log(`Mission upload failed: ${uploadResult.errorMessage}`);
      return;
    }

    // Example 2: Get mission status
    console.log('\n=== Mission Status ===');
    const status = await client.mission.requestMissionStatus();
    console.log(`Mission items: ${status.count}`);
    console.log(`Current item: ${status.current}`);
    console.log(`Items reached: ${status.reached}`);
    console.log(`Mission state: ${status.state}`);

    // Example 3: Download mission from FC
    console.log('\n=== Downloading Mission ===');
    const downloadedMission = await client.mission.downloadMission();
    console.log(`Downloaded ${downloadedMission.items.length} mission items:`);
    
    downloadedMission.items.forEach((item, index) => {
      const lat = item.x / 1e7;
      const lng = item.y / 1e7;
      console.log(`  ${index}: CMD=${item.command} LAT=${lat.toFixed(6)} LNG=${lng.toFixed(6)} ALT=${item.z}m`);
    });

    // Example 4: Mission event monitoring
    console.log('\n=== Setting up Mission Monitoring ===');
    const unsubscribe = client.mission.onMissionEvent((event) => {
      switch (event.type) {
        case 'mission_current':
          console.log(`Current mission item changed to: ${event.data.seq}`);
          break;
        case 'mission_item_reached':
          console.log(`Mission item reached: ${event.data.seq}`);
          break;
        case 'mission_ack':
          console.log(`Mission acknowledgment: ${event.data.result}`);
          break;
        default:
          console.log(`Mission event: ${event.type}`, event.data);
      }
    });

    // Example 5: Start mission (uncomment to actually start)
    /*
    console.log('\n=== Starting Mission ===');
    const startResult = await client.mission.startMission();
    if (startResult.success) {
      console.log('Mission started successfully');
    } else {
      console.log(`Mission start failed: ${startResult.errorMessage}`);
    }
    */

    // Example 6: Set current mission item
    console.log('\n=== Setting Current Mission Item ===');
    const setCurrentResult = await client.mission.setCurrentMissionItem(1);
    if (setCurrentResult.success) {
      console.log('Current mission item set to 1');
    } else {
      console.log(`Failed to set current item: ${setCurrentResult.errorMessage}`);
    }

    // Monitor for a few seconds then cleanup
    console.log('\nMonitoring mission events for 10 seconds...');
    setTimeout(() => {
      console.log('\nStopping mission monitoring');
      unsubscribe();
      client.disconnect();
    }, 10000);

  } catch (error) {
    console.error('Error:', error);
    client.disconnect();
  }
}

// Example usage for clearing mission
async function clearMissionExample() {
  const client = new MAVLinkBridgeClient('http://192.168.4.1');
  
  try {
    await client.connect();
    
    console.log('Clearing all mission items...');
    const result = await client.mission.clearMission();
    
    if (result.success) {
      console.log('Mission cleared successfully');
    } else {
      console.log(`Mission clear failed: ${result.errorMessage}`);
    }
    
  } catch (error) {
    console.error('Error clearing mission:', error);
  } finally {
    client.disconnect();
  }
}

// Run the example
if (require.main === module) {
  missionExample().catch(console.error);
}