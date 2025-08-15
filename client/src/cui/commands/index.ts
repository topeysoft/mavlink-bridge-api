import { CommandRegistry } from '../CommandRegistry';
import { registerDeviceCommands } from './deviceCommands';
import { registerConfigCommands } from './configCommands';
import { registerWiFiCommands } from './wifiCommands';
import { registerRTCMCommands } from './rtcmCommands';
import { registerHealthCommands } from './healthCommands';
import { registerUtilityCommands } from './utilityCommands';

/**
 * Register all available commands
 */
export function registerCommands(registry: CommandRegistry): void {
  registerDeviceCommands(registry);
  registerConfigCommands(registry);
  registerWiFiCommands(registry);
  registerRTCMCommands(registry);
  registerHealthCommands(registry);
  registerUtilityCommands(registry);
}