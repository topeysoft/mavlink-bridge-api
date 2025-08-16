import { CommandRegistry } from '../CommandRegistry';
import { Command, CommandContext, CommandArgs } from '../types';
import { MAVLinkBridgeClient } from '../../MAVLinkBridgeClient';
import { MissionItem, CreateWaypointOptions, MAVFrame } from '../../mavlink/MAVLinkMissionTypes';
import { CUIHelpers } from '../CUIHelpers';

export function registerMissionCommands(registry: CommandRegistry): void {
  // Mission upload command
  const missionUploadCommand: Command = {
    name: 'mission_upload',
    description: 'Upload mission plan to flight controller',
    category: 'Mission',
    usage: 'mission_upload <waypoints> [--system=1] [--component=1]',
    examples: [
      'mission_upload 47.6097,-122.3331,10 47.6098,-122.3332,15',
      'mission_upload 47.6097,-122.3331,10 --system=1'
    ],
    requiresConnection: true,
    execute: async (context: CommandContext, args: CommandArgs) => {
      if (!context.client) {
        CUIHelpers.printError('Not connected to device');
        return;
      }

      const waypoints = args._args || [];
      if (waypoints.length === 0) {
        CUIHelpers.printError('At least one waypoint required (format: lat,lng,alt)');
        return;
      }

      const systemId = parseInt(args.system as string || '1');
      const componentId = parseInt(args.component as string || '1');

      try {
        const missionItems: MissionItem[] = [];

        // Add takeoff as first item
        if (waypoints.length > 0) {
          const firstWaypoint = String(waypoints[0]).split(',');
          if (firstWaypoint.length !== 3) {
            CUIHelpers.printError('Invalid waypoint format. Use lat,lng,alt');
            return;
          }
          const lat = parseFloat(firstWaypoint[0] || '0');
          const lng = parseFloat(firstWaypoint[1] || '0');
          const alt = parseFloat(firstWaypoint[2] || '0');
          
          if (context.client) {
            missionItems.push(context.client.mission.createTakeoffItem(lat, lng, alt, 0));
          }
        }

        // Add waypoints
        waypoints.forEach((waypoint: any, index: number) => {
          const coords = String(waypoint).split(',');
          if (coords.length !== 3) {
            throw new Error(`Invalid waypoint format: ${waypoint}`);
          }

          const lat = parseFloat(coords[0] || '0');
          const lng = parseFloat(coords[1] || '0');
          const alt = parseFloat(coords[2] || '0');

          if (isNaN(lat) || isNaN(lng) || isNaN(alt)) {
            throw new Error(`Invalid coordinates: ${waypoint}`);
          }

          if (context.client) {
            missionItems.push(context.client.mission.createWaypoint({
              lat,
              lng,
              alt,
              seq: index + 1
            }));
          }
        });

        // Add RTL as last item
        if (waypoints.length > 0 && context.client) {
          missionItems.push(context.client.mission.createReturnToLaunchItem(waypoints.length + 1));
        }

        const result = await context.client.mission.uploadMission(
          { items: missionItems },
          { targetSystem: systemId, targetComponent: componentId }
        );

        if (result.success) {
          CUIHelpers.printSuccess(`Mission uploaded successfully: ${result.itemsProcessed}/${result.totalItems} items`);
        } else {
          CUIHelpers.printError(`Mission upload failed: ${result.errorMessage}`);
        }
      } catch (error) {
        CUIHelpers.printError(`Error uploading mission: ${error}`);
      }
    }
  };

  // Mission download command  
  const missionDownloadCommand: Command = {
    name: 'mission_download',
    description: 'Download mission plan from flight controller',
    category: 'Mission',
    usage: 'mission_download [--system=1] [--component=1]',
    requiresConnection: true,
    execute: async (context: CommandContext, args: CommandArgs) => {
      if (!context.client) {
        CUIHelpers.printError('Not connected to device');
        return;
      }

      const systemId = parseInt(args.system as string || '1');
      const componentId = parseInt(args.component as string || '1');

      try {
        const mission = await context.client.mission.downloadMission({
          targetSystem: systemId,
          targetComponent: componentId
        });

        if (mission.items.length === 0) {
          CUIHelpers.printWarning('No mission items found on flight controller');
          return;
        }

        CUIHelpers.printSuccess(`Downloaded mission with ${mission.items.length} items:`);
        mission.items.forEach((item, index) => {
          const lat = item.x / 1e7;
          const lng = item.y / 1e7;
          console.log(`  ${index}: CMD=${item.command} LAT=${lat.toFixed(6)} LNG=${lng.toFixed(6)} ALT=${item.z}m`);
        });
      } catch (error) {
        CUIHelpers.printError(`Error downloading mission: ${error}`);
      }
    }
  };

  // Mission clear command
  const missionClearCommand: Command = {
    name: 'mission_clear',
    description: 'Clear all mission items from flight controller',
    category: 'Mission',
    usage: 'mission_clear [--system=1] [--component=1]',
    requiresConnection: true,
    execute: async (context: CommandContext, args: CommandArgs) => {
      if (!context.client) {
        CUIHelpers.printError('Not connected to device');
        return;
      }

      const systemId = parseInt(args.system as string || '1');
      const componentId = parseInt(args.component as string || '1');

      try {
        const result = await context.client.mission.clearMission({
          targetSystem: systemId,
          targetComponent: componentId
        });

        if (result.success) {
          CUIHelpers.printSuccess('Mission cleared successfully');
        } else {
          CUIHelpers.printError(`Mission clear failed: ${result.errorMessage}`);
        }
      } catch (error) {
        CUIHelpers.printError(`Error clearing mission: ${error}`);
      }
    }
  };

  // Mission start command
  const missionStartCommand: Command = {
    name: 'mission_start',
    description: 'Start mission execution',
    category: 'Mission',
    usage: 'mission_start [--system=1] [--component=1]',
    requiresConnection: true,
    execute: async (context: CommandContext, args: CommandArgs) => {
      if (!context.client) {
        CUIHelpers.printError('Not connected to device');
        return;
      }

      const systemId = parseInt(args.system as string || '1');
      const componentId = parseInt(args.component as string || '1');

      try {
        const result = await context.client.mission.startMission({
          targetSystem: systemId,
          targetComponent: componentId
        });

        if (result.success) {
          CUIHelpers.printSuccess('Mission started successfully');
        } else {
          CUIHelpers.printError(`Mission start failed: ${result.errorMessage}`);
        }
      } catch (error) {
        CUIHelpers.printError(`Error starting mission: ${error}`);
      }
    }
  };

  // Mission status command
  const missionStatusCommand: Command = {
    name: 'mission_status',
    description: 'Get mission status and progress',
    category: 'Mission',
    usage: 'mission_status [--system=1] [--component=1]',
    requiresConnection: true,
    execute: async (context: CommandContext, args: CommandArgs) => {
      if (!context.client) {
        CUIHelpers.printError('Not connected to device');
        return;
      }

      const systemId = parseInt(args.system as string || '1');
      const componentId = parseInt(args.component as string || '1');

      try {
        const status = await context.client.mission.requestMissionStatus({
          targetSystem: systemId,
          targetComponent: componentId
        });

        CUIHelpers.printInfo('Mission Status:');
        console.log(`  Total Items: ${status.count}`);
        console.log(`  Current Item: ${status.current}`);
        console.log(`  Items Reached: ${status.reached}`);
        console.log(`  State: ${status.state}`);
      } catch (error) {
        CUIHelpers.printError(`Error getting mission status: ${error}`);
      }
    }
  };

  registry.register(missionUploadCommand);
  registry.register(missionDownloadCommand);
  registry.register(missionClearCommand);
  registry.register(missionStartCommand);
  registry.register(missionStatusCommand);
}