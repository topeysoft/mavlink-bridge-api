# MAVLinkBridge Command-Line Interface (CUI)

A comprehensive command-line interface for interacting with MAVLinkBridge ESP32 devices.

## Features

- **Device Management**: Connect, disconnect, status monitoring, and device information
- **WiFi Control**: Network scanning, connection management, saved networks
- **RTCM Handling**: RTCM client configuration, start/stop, statistics
- **Configuration Management**: View and modify device settings
- **Health Monitoring**: System health, memory usage, task information
- **Real-time Events**: Live monitoring of device events and logs

## Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run the CLI
npm run cli
```

## Usage

### Starting the CLI

```bash
# Start with default settings
npm run cli

# Connect to specific device URL
npm run cli -- --url http://192.168.1.100

# Auto-connect on startup
npm run cli -- --connect

# Enable verbose output
npm run cli -- --verbose
```

### Available Commands

#### Device Commands
- `connect <url>` - Connect to a MAVLinkBridge device
- `disconnect` - Disconnect from current device
- `status` - Show device status and health
- `ping` - Test device connectivity
- `info` - Show detailed device information

#### WiFi Commands
- `wifi status` - Show WiFi connection status
- `wifi scan` - Scan for available networks
- `wifi connect <ssid> [password]` - Connect to WiFi network
- `wifi disconnect` - Disconnect from WiFi
- `wifi saved` - Show saved networks
- `wifi add <ssid> <password>` - Add network to saved list
- `wifi remove <ssid>` - Remove network from saved list

#### RTCM Commands
- `rtcm status` - Show RTCM client status
- `rtcm start` - Start RTCM client
- `rtcm stop` - Stop RTCM client
- `rtcm config <type> <host> <port>` - Configure RTCM source
- `rtcm stats` - Show RTCM statistics

#### Configuration Commands
- `config show` - Display current configuration
- `config set <path> <value>` - Set configuration value
- `config reset --confirm` - Reset to defaults

#### Health Commands
- `health` - Show system health overview
- `memory` - Show memory information
- `tasks` - Show running tasks
- `cpu` - Show CPU usage

#### Utility Commands
- `help [command]` - Show help information
- `monitor [on|off]` - Toggle real-time event monitoring
- `verbose [on|off]` - Toggle verbose output
- `clear` - Clear console screen
- `version` - Show version information
- `about` - Show application information
- `exit` - Exit the CLI

### Examples

```bash
# Connect to device
> connect http://192.168.4.1

# Check device status
> status

# Scan for WiFi networks
> wifi scan

# Connect to WiFi
> wifi connect "MyNetwork" "password123" --save

# Configure RTCM
> rtcm config ntrip rtk2go.com 2101 --mountpoint=MyMount

# Start RTCM client
> rtcm start

# Monitor real-time events
> monitor on

# Show device configuration
> config show

# Set device name
> config set device.name "My Device"

# Show memory usage
> memory

# Exit
> exit
```

## Architecture

The CUI is built with a modular architecture:

### Core Components

- **CUIApplication**: Main application class managing the command loop
- **CommandRegistry**: Central registry for all available commands
- **CommandParser**: Parses user input into structured commands
- **CUIHelpers**: Utility functions for formatting and display

### Command Categories

Commands are organized into logical categories:

- **Device**: Connection and basic device operations
- **WiFi**: WiFi network management
- **RTCM**: RTCM client control
- **Configuration**: Device configuration management
- **Health**: System monitoring and diagnostics
- **Utility**: Helper commands and tools

### Features

- **Command Completion**: Tab completion for commands
- **Command History**: Navigate through command history
- **Real-time Monitoring**: Live event streaming from device
- **Colored Output**: Syntax highlighting and status colors
- **Error Handling**: Comprehensive error reporting
- **Progress Indicators**: Spinners for long-running operations

## Development

### Adding New Commands

1. Create command in appropriate category file (`src/cui/commands/`)
2. Implement the `Command` interface
3. Register the command in the category's register function
4. Add to the main registry in `src/cui/commands/index.ts`

### Command Structure

```typescript
const myCommand: Command = {
  name: 'mycommand',
  description: 'Description of what the command does',
  category: 'Category',
  usage: 'mycommand <arg> [options]',
  examples: ['mycommand example'],
  requiresConnection: true, // if device connection needed
  execute: async (context: CommandContext, args: CommandArgs) => {
    // Command implementation
  }
};
```

### Testing

The CUI can be tested without a physical device by using mock responses or by connecting to a development server.

## Error Handling

The CUI provides comprehensive error handling:

- Connection errors are clearly reported
- Command errors show helpful messages
- Verbose mode provides detailed stack traces
- Invalid commands show suggestions

## Configuration

The CUI can be configured via command-line options:

- `--url`: Default device URL
- `--connect`: Auto-connect on startup
- `--verbose`: Enable verbose output
- `--no-color`: Disable colored output
- `--timeout`: Command timeout in milliseconds
- `--history`: Command history size

## Dependencies

- **commander**: Command-line argument parsing
- **inquirer**: Interactive prompts
- **chalk**: Terminal colors and styling
- **cli-table3**: Formatted table output
- **ora**: Progress spinners
- **readline**: Interactive command line

## License

MIT License - see the main project LICENSE file for details.