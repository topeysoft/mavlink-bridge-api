# YardRover API Test Suite

This directory contains comprehensive unit tests for the YardRover API backend implementation.

## Test Coverage

### High Priority Components (Completed)
- **NVSManager** - Non-volatile storage management
- **WiFiManager** - Network connectivity and AP management
- **HealthMonitor** - System health monitoring
- **ErrorHandler** - Error logging and recovery

### Medium Priority Components (Pending)
- **UARTManager** - Serial communication
- **USBOTGManager** - USB host functionality
- **MAVLinkConverter** - MAVLink message conversion
- **ConfigEndpoints** - Configuration REST API

### Low Priority Components (Pending)
- **MissionTaskManager** - Mission management
- **TaskStorageManager** - Task persistence

## Running Tests

### Prerequisites
- PlatformIO Core installed (`pip install platformio`)
- ESP32-S3 development board (for hardware tests)
- USB cable for board connection

### Basic Commands

#### Run all tests
```bash
pio test
```

#### Run tests for specific environment
```bash
# ESP32-S3 environment
pio test -e esp32s3

# ESP32-S2 environment
pio test -e esp32s2

# Native environment (limited functionality)
pio test -e test
```

#### Run specific test
```bash
# Single test
pio test -e esp32s3 -f test_nvs_manager

# Multiple tests
pio test -e esp32s3 -f test_nvs_manager -f test_wifi_manager
```

#### Run with verbose output
```bash
pio test -v
```

### Hardware Testing

To run tests on actual hardware:

1. Connect your ESP32-S3 board via USB
2. Find the port:
   ```bash
   # macOS
   ls /dev/tty.usbserial*
   
   # Linux
   ls /dev/ttyUSB*
   
   # Windows
   # Check Device Manager for COM port
   ```
3. Run tests on hardware:
   ```bash
   pio test -e esp32s3 --upload-port /dev/ttyUSB0
   ```

### Test Scripts

A convenience script is provided for common test scenarios:

```bash
# Run all high-priority component tests
./test.sh

# Run specific test
./test.sh nvs_manager

# Run with custom environment
./test.sh all esp32s2
```

## Test Structure

Each test file follows this pattern:

```cpp
#include <unity.h>
#include <ComponentHeader.h>

void setUp(void) {
    // Setup before each test
}

void tearDown(void) {
    // Cleanup after each test
}

void test_component_functionality(void) {
    // Test implementation
    TEST_ASSERT_EQUAL(expected, actual);
}

void setup() {
    UNITY_BEGIN();
    RUN_TEST(test_component_functionality);
    UNITY_END();
}

void loop() {
    // Empty
}
```

## Writing New Tests

1. Create a new directory: `test/test_component_name/`
2. Create test file: `test_component_name.cpp`
3. Include necessary headers
4. Implement setUp() and tearDown()
5. Write test functions prefixed with `test_`
6. Register tests in setup() with RUN_TEST()

### Test Best Practices

- Test both success and failure cases
- Test edge cases and boundary conditions
- Mock external dependencies when possible
- Keep tests isolated and independent
- Use descriptive test names
- Clean up resources in tearDown()
- Test null safety and error handling

## Continuous Integration

Tests can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Run PlatformIO Tests
  run: |
    pip install platformio
    pio test -e esp32s3
```

## Troubleshooting

### Common Issues

1. **Port permission denied**
   ```bash
   sudo chmod 666 /dev/ttyUSB0
   # or add user to dialout group
   sudo usermod -a -G dialout $USER
   ```

2. **Test timeout**
   - Increase timeout in platformio.ini
   - Check for blocking operations in tests

3. **Memory issues**
   - Reduce test complexity
   - Run tests in smaller batches
   - Check for memory leaks

### Debug Output

Enable debug logging:
```bash
pio test -e esp32s3 -v --monitor-echo
```

## Test Reports

Generate test reports:
```bash
# JSON format
pio test --json-output-path test_results.json

# JUnit XML format (with plugin)
pio test --junit-output-path test_results.xml
```

## Contributing

When adding new tests:
1. Follow existing test patterns
2. Ensure comprehensive coverage
3. Document any special requirements
4. Update this README with new components
5. Verify tests pass before committing