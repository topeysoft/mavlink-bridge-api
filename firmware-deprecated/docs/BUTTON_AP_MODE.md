# Physical Button AP Mode Control

## Overview

The ESP32 device can be forced into Access Point (AP) mode using the physical BOOT button (GPIO0). This is useful when:

- Device is connected to WiFi but you need to access it directly
- You've lost WiFi credentials
- You need emergency access to the device
- Device is in an unknown WiFi network

## How to Use

### Force AP Mode with BOOT Button

1. **Locate the BOOT button** on your ESP32 board (usually labeled "BOOT" or "IO0")

2. **Press and hold** the BOOT button for **3 seconds**

3. **Release** the button when you see the serial output:

   ```
   🔘 BOOT Button Long Press Detected!
      Forcing Access Point Mode...
   ✓ Access Point Started
      SSID: MAVLinkBridge-Setup
      IP: 192.168.4.1
      Connect and visit: http://192.168.4.1
   ```

4. **Connect your device** (phone/laptop) to the WiFi network displayed in the serial output

5. **Open a browser** and navigate to `http://192.168.4.1` to access the device's API

### What Happens

When you long-press the BOOT button:

- The device starts its Access Point (AP) mode
- The AP runs simultaneously with any existing WiFi connection (AP+STA mode)
- You can connect to the AP and access the device's HTTP API
- The device remains connected to its WiFi network (if connected)

## Configuration

The button behavior can be configured in [config.h](../src/config.h):

```cpp
// Button configuration
#define BOOT_BUTTON_PIN 0               // GPIO0 is the BOOT button
#define BUTTON_LONG_PRESS_MS 3000       // 3 seconds to trigger AP mode
#define BUTTON_DEBOUNCE_MS 50           // 50ms debounce delay
```

### Changing the Button Pin

If your ESP32 board uses a different GPIO for the BOOT button, or you want to use a custom button:

```cpp
#define BOOT_BUTTON_PIN 9  // Change to your GPIO number
```

### Adjusting Long Press Duration

To require a longer or shorter press:

```cpp
#define BUTTON_LONG_PRESS_MS 5000  // 5 seconds
```

## Technical Details

### ButtonHandler Class

The button handling is implemented in the `ButtonHandler` class:

- **Location**: `lib/core/ButtonHandler/`
- **Features**:
  - Debounced button press detection
  - Long press detection
  - Callback-based event handling
  - Non-blocking operation

### Button Events

The ButtonHandler supports three event types:

- `PRESS` - Short press (released before long press threshold)
- `LONG_PRESS` - Long press detected (triggers AP mode)
- `RELEASE` - Button released

### Integration

The button handler is integrated in `main.cpp`:

1. Initialized during setup with configured GPIO and timing
2. Updated in the main loop to check button state
3. Callback function handles long press by starting AP mode

## Troubleshooting

### Button Not Responding

1. **Check Serial Output**: Make sure the ButtonHandler initialization message appears

   ```
   ✓ Button Handler initialized (GPIO0, long press: 3000ms)
   ```

2. **Verify GPIO Pin**: Ensure `BOOT_BUTTON_PIN` matches your board's button

3. **Test Button**: Try a shorter press to verify the button is working (should see press events in debug mode)

### AP Mode Not Starting

If AP mode doesn't start after long press:

1. Check that `apModeEnabled` is `true` in WiFi configuration
2. Verify AP SSID and password are configured
3. Check serial output for error messages

### AP Already Active

If you see "Access Point already active", the device is already in AP mode. You can:

- Connect to the existing AP network
- Stop the AP first via API: `POST /api/wifi/ap/stop` (once implemented)

## API Control

While the physical button provides emergency access, you can also control AP mode via API (once implemented):

```bash
# Start AP mode
curl -X POST http://device-ip/api/wifi/ap/start

# Stop AP mode  
curl -X POST http://device-ip/api/wifi/ap/stop

# Check AP status
curl http://device-ip/api/wifi/status
```

## Use Cases

### Lost WiFi Credentials

1. Long-press BOOT button
2. Connect to AP network
3. Access device at <http://192.168.4.1>
4. Configure new WiFi credentials via API

### Emergency Access

If the device is on a network you can't access:

1. Long-press BOOT button
2. Connect directly to AP
3. Troubleshoot or reconfigure

### Field Configuration

When deploying devices without prior WiFi setup:

1. Power on device
2. Long-press BOOT button
3. Connect and configure on-site

## Safety Features

- **Debouncing**: 50ms debounce prevents accidental triggers
- **Long Press**: 3-second requirement prevents accidental activation
- **Non-blocking**: Button checking doesn't interfere with device operation
- **Simultaneous Mode**: AP + Station mode allows maintaining WiFi connection

## See Also

- [WiFi Configuration](./WIFI_SETUP.md)
- [config.h](../src/config.h) - Button configuration
- [ButtonHandler Source](../lib/core/ButtonHandler/) - Implementation details
