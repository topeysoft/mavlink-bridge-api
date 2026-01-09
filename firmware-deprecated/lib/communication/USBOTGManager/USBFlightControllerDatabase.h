#ifndef FLIGHT_CONTROLLER_DATABASE_H
#define FLIGHT_CONTROLLER_DATABASE_H

#include <stdint.h>

/**
 * Flight Controller USB Device Database
 *
 * This file contains definitions for known flight controller USB devices.
 * Each entry includes the USB Vendor ID (VID), Product ID (PID), vendor name, and product name.
 *
 * HOW TO ADD A NEW FLIGHT CONTROLLER:
 *
 * 1. Find the USB VID/PID of your flight controller:
 *    - Connect the flight controller via USB
 *    - Check device manager (Windows), lsusb (Linux), or system_profiler SPUSBDataType (macOS)
 *    - Look for vendor ID and product ID (hexadecimal values)
 *
 * 2. Add a new entry to the known_flight_controllers array BEFORE the end marker:
 *    {0xVVVV, 0xPPPP, "Vendor Name", "Product Name"},
 *
 *    Where:
 *    - 0xVVVV is the 4-digit hexadecimal Vendor ID
 *    - 0xPPPP is the 4-digit hexadecimal Product ID
 *    - "Vendor Name" is the manufacturer name (keep it short)
 *    - "Product Name" is the specific model/product name
 *
 * 3. Example for a new SpeedyBee controller with VID=0x1209, PID=0x5742:
 *    {0x1209, 0x5742, "SpeedyBee", "F7 Mini Flight Controller"},
 *
 * IMPORTANT NOTES:
 * - Always add new entries BEFORE the end marker entry {0x0000, 0x0000, nullptr, nullptr}
 * - Use hexadecimal format (0x prefix) for VID/PID values
 * - Keep vendor and product names concise but descriptive
 * - The array is terminated by the special end marker - do not remove it!
 * - USB-to-serial adapters (FTDI, CP210x, CH340) are included for generic flight controllers
 */

// Flight controller USB device definition structure
struct FlightControllerUSB
{
    uint16_t vid;        // USB Vendor ID
    uint16_t pid;        // USB Product ID
    const char *vendor;  // Vendor/manufacturer name
    const char *product; // Product/model name
};

// Known flight controller USB VID/PID combinations
static const FlightControllerUSB known_flight_controllers[] = {
    // 3D Robotics / ArduPilot
    {0x26AC, 0x0010, "3D Robotics", "PX4 FMU"},
    {0x26AC, 0x0011, "3D Robotics", "PX4 FMU Bootloader"},
    {0x26AC, 0x0012, "3D Robotics", "PX4 FLOW"},

    // Holybro (Pixhawk 4/5/6)
    {0x3162, 0x004B, "Holybro", "Pixhawk 4"},
    {0x3162, 0x004C, "Holybro", "Pixhawk 4 Mini"},
    {0x3162, 0x0050, "Holybro", "Pixhawk 5X"},
    {0x3162, 0x0051, "Holybro", "Pixhawk 6C"},

    // Hex Technology (Cube)
    {0x2DAE, 0x1011, "Hex/ProfiCNC", "CubeBlack"},
    {0x2DAE, 0x1012, "Hex/ProfiCNC", "CubeOrange"},
    {0x2DAE, 0x1016, "Hex/ProfiCNC", "CubePurple"},

    // FTDI (common USB-Serial adapters)
    {0x0403, 0x6001, "FTDI", "FT232R USB UART"},
    {0x0403, 0x6014, "FTDI", "FT232H USB UART"},
    {0x0403, 0x6015, "FTDI", "FT-X Series USB UART"},

    // Silicon Labs (CP210x series)
    {0x10C4, 0xEA60, "Silicon Labs", "CP210x UART Bridge"},
    {0x10C4, 0xEA70, "Silicon Labs", "CP210x UART Bridge"},

    // WCH (CH340/CH341 series)
    {0x1A86, 0x7523, "WCH", "CH340 USB-Serial"},
    {0x1A86, 0x5523, "WCH", "CH341 USB-Serial"},

    // Matek Systems
    {0x0483, 0x5740, "Matek", "F405/F765 Flight Controller"},

    // ArduPilot.org (via pid.codes VID 0x1209)
    {0x1209, 0x5740, "ArduPilot.org", "Autopilot (RadioLink PIX6)"},
    {0x1209, 0x5741, "ArduPilot.org", "Autopilot (SpeedyBee F405-WING)"},
    // Example: To add SpeedyBee F7 Mini, uncomment the line below after confirming VID/PID:
    // {0x1209, 0x5742, "SpeedyBee", "F7 Mini Flight Controller"},

    // End marker - DO NOT REMOVE THIS ENTRY!
    {0x0000, 0x0000, nullptr, nullptr}};

#endif // FLIGHT_CONTROLLER_DATABASE_H