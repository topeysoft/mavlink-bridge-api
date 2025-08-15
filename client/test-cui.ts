#!/usr/bin/env ts-node

// Simple test script to check if the CUI application starts
import { CUIApplication } from './src/cui/CUIApplication';

async function test() {
  try {
    console.log('Testing CUI Application...');
    
    const app = new CUIApplication({
      defaultDeviceUrl: 'http://192.168.4.1',
      autoConnect: false,
      verbose: true
    });
    
    console.log('CUI Application created successfully!');
    console.log('Command registry has', app.getCommandRegistry().getAll().length, 'commands');
    
    // List available commands
    const commands = app.getCommandRegistry().getAll();
    console.log('\nAvailable commands:');
    commands.forEach(cmd => {
      console.log(`  ${cmd.name} - ${cmd.description}`);
    });
    
    console.log('\nTest completed successfully!');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

test();