#include "SerialRTCMTransport.h"
#include <esp_log.h>

static const char* TAG = "SerialRTCMTransport";

SerialRTCMTransport::SerialRTCMTransport()
    : dataRouter(nullptr)
    , targetInterface(DataRouter::NONE)
    , directSerial(nullptr)
    , useDataRouter(true) {
    periodStartTime = millis();
}

SerialRTCMTransport::~SerialRTCMTransport() {
    end();
}

bool SerialRTCMTransport::begin(const JsonObjectConst& config) {
    // Parse configuration
    // Expected: { "interface": "usb" | "uart" | "auto", "direct": false }

    const char* interfaceStr = config["interface"] | "auto";
    useDataRouter = !(config["direct"] | false);

    if (useDataRouter) {
        dataRouter = DataRouter::getInstance();
        if (!dataRouter) {
            ESP_LOGE(TAG, "DataRouter not available");
            setState(ERROR);
            return false;
        }

        // Determine target interface
        if (strcmp(interfaceStr, "usb") == 0) {
            targetInterface = DataRouter::USB_OTG;
        } else if (strcmp(interfaceStr, "uart") == 0) {
            targetInterface = DataRouter::UART;
        } else {
            targetInterface = DataRouter::NONE;  // Auto
        }

        ESP_LOGI(TAG, "Using DataRouter with interface: %s", interfaceStr);
    } else {
        // Direct serial access (advanced use case)
        int serialNum = config["serial"] | 0;
        switch (serialNum) {
            case 0: directSerial = &Serial; break;
            case 1: directSerial = &Serial1; break;
            case 2: directSerial = &Serial2; break;
            default:
                ESP_LOGE(TAG, "Invalid serial number: %d", serialNum);
                setState(ERROR);
                return false;
        }

        ESP_LOGI(TAG, "Using direct Serial%d access", serialNum);
    }

    setState(CONNECTED);
    return true;
}

void SerialRTCMTransport::end() {
    setState(DISCONNECTED);
    dataRouter = nullptr;
    directSerial = nullptr;
}

size_t SerialRTCMTransport::send(const uint8_t* data, size_t length) {
    if (!isReady()) {
        recordError();
        return 0;
    }

    size_t sent = 0;

    if (useDataRouter && dataRouter) {
        // Route through DataRouter
        dataRouter->routeDownstream(data, length);
        sent = length;  // DataRouter doesn't return sent size
    } else if (directSerial) {
        // Direct serial write
        sent = directSerial->write(data, length);
    }

    if (sent > 0) {
        updateStatistics(sent);
        ESP_LOGD(TAG, "Sent %d bytes via serial", sent);
    } else {
        recordError();
    }

    return sent;
}

bool SerialRTCMTransport::isReady() const {
    if (currentState != CONNECTED) {
        return false;
    }

    if (useDataRouter) {
        return dataRouter != nullptr;
    } else {
        return directSerial != nullptr;
    }
}

SerialRTCMTransport::State SerialRTCMTransport::getState() const {
    return currentState;
}
