#ifdef CONFIG_IDF_TARGET_ESP32S3

#include "USBHostImpl.h"
#include "USBFlightControllerDatabase.h"
#include <esp_log.h>
#include <vector>

static const char *TAG = "USBHostImpl";

USBHostImpl::USBHostImpl() : initialized(false),
                             deviceConnected(false),
                             baudRate(115200),
                             clientHandle(nullptr),
                             deviceHandle(nullptr),
                             usbHostTaskHandle(nullptr),
                             classDriverTaskHandle(nullptr),
                             eventQueue(nullptr),
                             usbMutex(nullptr),
                             pendingDeviceCount(0),
                             enumerationFilterEnabled(false),
                             bulkInTransfer(nullptr),
                             bulkOutTransfer(nullptr),
                             bulkInEpAddr(0),
                             bulkOutEpAddr(0),
                             transfersActive(false),
                             bulkOutTransferInProgress(false),
                             transferCompleteSemaphore(nullptr),
                             transferTimeoutMs(1000),
                             consecutiveTransferFailures(0),
                             lastTransferFailureTime(0),
                             rxBufferHead(0),
                             rxBufferTail(0),
                             rxBufferCount(0)
{

    memset(&stats, 0, sizeof(stats));
    memset(&deviceInfo, 0, sizeof(deviceInfo));
    memset(pendingDevices, 0, sizeof(pendingDevices));
    memset(rxBuffer, 0, sizeof(rxBuffer));
    memset(txBuffer, 0, sizeof(txBuffer));
}

USBHostImpl::~USBHostImpl()
{
    end();
}

bool USBHostImpl::begin()
{
    if (initialized)
    {
        ESP_LOGW(TAG, "Already initialized");
        Serial.printf("⚠️ USB Host already initialized\n");
        return true;
    }

    ESP_LOGI(TAG, "Initializing USB Host");
    Serial.printf("\n🚀 Starting USB Host Implementation...\n");

    // Create synchronization objects
    usbMutex = xSemaphoreCreateMutex();
    if (!usbMutex)
    {
        ESP_LOGE(TAG, "Failed to create mutex");
        return false;
    }

    transferCompleteSemaphore = xSemaphoreCreateBinary();
    if (!transferCompleteSemaphore)
    {
        ESP_LOGE(TAG, "Failed to create transfer semaphore");
        vSemaphoreDelete(usbMutex);
        return false;
    }

    eventQueue = xQueueCreate(10, sizeof(USBHostEventMessage));
    if (!eventQueue)
    {
        ESP_LOGE(TAG, "Failed to create event queue");
        vSemaphoreDelete(usbMutex);
        vSemaphoreDelete(transferCompleteSemaphore);
        return false;
    }

    // Initialize USB Host
    if (!initializeUSBHost())
    {
        ESP_LOGE(TAG, "Failed to initialize USB Host");
        vSemaphoreDelete(usbMutex);
        return false;
    }

    // Set initialized flag BEFORE creating tasks so they don't exit immediately
    initialized = true;

    // Create USB Host task
    BaseType_t taskCreated = xTaskCreatePinnedToCore(
        usbHostLibTask,
        "usb_host_task",
        4096,
        this,
        5,
        &usbHostTaskHandle,
        1);

    if (taskCreated != pdPASS)
    {
        ESP_LOGE(TAG, "Failed to create USB Host task");
        cleanupUSBHost();
        vSemaphoreDelete(usbMutex);
        return false;
    }

    // Create class driver task
    taskCreated = xTaskCreatePinnedToCore(
        classDriverTask,
        "usb_class_driver",
        4096,
        this,
        4,
        &classDriverTaskHandle,
        1);

    if (taskCreated != pdPASS)
    {
        ESP_LOGE(TAG, "Failed to create class driver task");
        Serial.printf("❌ Failed to create class driver task\n");
        vTaskDelete(usbHostTaskHandle);
        cleanupUSBHost();
        vSemaphoreDelete(usbMutex);
        return false;
    }

    Serial.printf("✅ All USB Host tasks created successfully\n");

    ESP_LOGI(TAG, "USB Host initialized successfully");
    Serial.printf("🎉 USB Host Implementation fully initialized!\n");
    Serial.printf("📡 Ready to detect USB devices on GPIO19/20...\n\n");
    return true;
}

void USBHostImpl::end()
{
    if (!initialized)
    {
        return;
    }

    ESP_LOGI(TAG, "Shutting down USB Host");

    initialized = false;

    // Stop USB transfers
    stopUSBTransfers();

    // Delete class driver task
    if (classDriverTaskHandle)
    {
        vTaskDelete(classDriverTaskHandle);
        classDriverTaskHandle = nullptr;
    }

    // Delete USB Host task
    if (usbHostTaskHandle)
    {
        vTaskDelete(usbHostTaskHandle);
        usbHostTaskHandle = nullptr;
    }

    // Cleanup USB Host
    cleanupUSBHost();

    // Delete synchronization objects
    if (eventQueue)
    {
        vQueueDelete(eventQueue);
        eventQueue = nullptr;
    }

    if (transferCompleteSemaphore)
    {
        vSemaphoreDelete(transferCompleteSemaphore);
        transferCompleteSemaphore = nullptr;
    }

    if (usbMutex)
    {
        vSemaphoreDelete(usbMutex);
        usbMutex = nullptr;
    }

    // Reset state
    deviceConnected = false;
    memset(&deviceInfo, 0, sizeof(deviceInfo));

    ESP_LOGI(TAG, "USB Host shutdown complete");
}

bool USBHostImpl::initializeUSBHost()
{
    Serial.printf("\n🚀 STARTING USB HOST INITIALIZATION\n");
    ESP_LOGI(TAG, "Installing USB Host Library");

    // Configure USB Host
    const usb_host_config_t hostConfig = {
        .skip_phy_setup = false,
        .intr_flags = ESP_INTR_FLAG_LEVEL1,
        .enum_filter_cb = enumerationFilterEnabled ? enumerationFilterCallback : nullptr,
    };

    Serial.printf("🔧 USB Host Config:\n");
    Serial.printf("   skip_phy_setup: %s\n", hostConfig.skip_phy_setup ? "true" : "false");
    Serial.printf("   enum_filter_enabled: %s\n", enumerationFilterEnabled ? "true" : "false");
    Serial.printf("   enum_filter_cb: %p\n", hostConfig.enum_filter_cb);

    esp_err_t err = usb_host_install(&hostConfig);
    if (err != ESP_OK)
    {
        ESP_LOGE(TAG, "Failed to install USB host: %s", esp_err_to_name(err));
        Serial.printf("❌ USB Host install FAILED: %s\n", esp_err_to_name(err));
        return false;
    }

    ESP_LOGI(TAG, "USB Host installed successfully");
    Serial.printf("✅ USB Host installed successfully\n");

    // Register USB client
    const usb_host_client_config_t clientConfig = {
        .is_synchronous = false,
        .max_num_event_msg = 5,
        .async = {
            .client_event_callback = clientEventCallback,
            .callback_arg = this,
        }};

    err = usb_host_client_register(&clientConfig, &clientHandle);
    if (err != ESP_OK)
    {
        ESP_LOGE(TAG, "Failed to register USB client: %s", esp_err_to_name(err));
        usb_host_uninstall();
        return false;
    }

    ESP_LOGI(TAG, "USB client registered successfully");
    return true;
}

void USBHostImpl::cleanupUSBHost()
{
    // Deregister USB client
    if (clientHandle)
    {
        esp_err_t err = usb_host_client_deregister(clientHandle);
        if (err != ESP_OK)
        {
            ESP_LOGE(TAG, "Failed to deregister USB client: %s", esp_err_to_name(err));
        }
        clientHandle = nullptr;
    }

    // Uninstall USB host
    esp_err_t err = usb_host_uninstall();
    if (err != ESP_OK)
    {
        ESP_LOGE(TAG, "Failed to uninstall USB host: %s", esp_err_to_name(err));
    }
}

void USBHostImpl::usbHostLibTask(void *arg)
{
    USBHostImpl *host = static_cast<USBHostImpl *>(arg);
    ESP_LOGI(TAG, "USB Host task started");
    Serial.printf("🏃 USB Host task started - monitoring for USB events...\n");

    uint32_t loopCounter = 0;

    while (host->initialized)
    {
        loopCounter++;

        // Print status every 5 seconds (assuming 100ms delay = 50 loops per 5 seconds)
        // if (loopCounter % 50 == 0) {
        //     Serial.printf("💓 USB Host task alive (loop %lu) - monitoring...\n", loopCounter);
        // }
        // Handle USB host library events
        uint32_t eventFlags;
        esp_err_t err = usb_host_lib_handle_events(pdMS_TO_TICKS(100), &eventFlags);

        if (err == ESP_OK)
        {
            if (eventFlags & USB_HOST_LIB_EVENT_FLAGS_NO_CLIENTS)
            {
                ESP_LOGD(TAG, "No USB clients");
                if (loopCounter % 50 == 0)
                {
                    Serial.printf("   📊 Status: No USB clients registered\n");
                }
            }
            if (eventFlags & USB_HOST_LIB_EVENT_FLAGS_ALL_FREE)
            {
                ESP_LOGD(TAG, "All USB devices freed");
                if (loopCounter % 50 == 0)
                {
                    Serial.printf("   📊 Status: All USB devices freed\n");
                }
            }
            if (eventFlags != 0 && loopCounter % 50 != 0)
            {
                Serial.printf("🔔 USB Host event flags: 0x%08lX\n", eventFlags);
            }
        }
        else if (err != ESP_ERR_TIMEOUT)
        {
            ESP_LOGW(TAG, "USB host lib handle events error: %s", esp_err_to_name(err));
            Serial.printf("⚠️ USB host lib error: %s\n", esp_err_to_name(err));
        }

        // Handle USB client events
        if (host->clientHandle)
        {
            err = usb_host_client_handle_events(host->clientHandle, pdMS_TO_TICKS(10));
            if (err != ESP_OK && err != ESP_ERR_TIMEOUT)
            {
                ESP_LOGW(TAG, "USB client handle events error: %s", esp_err_to_name(err));
                Serial.printf("⚠️ USB client events error: %s\n", esp_err_to_name(err));
            }
        }
        else
        {
            if (loopCounter % 50 == 0)
            {
                Serial.printf("   📊 Status: No USB client handle available\n");
            }
        }

        vTaskDelay(pdMS_TO_TICKS(10));
    }

    ESP_LOGI(TAG, "USB Host task ending");
    vTaskDelete(nullptr);
}

void USBHostImpl::clientEventCallback(const usb_host_client_event_msg_t *eventMsg, void *arg)
{
    USBHostImpl *host = static_cast<USBHostImpl *>(arg);

    switch (eventMsg->event)
    {
    case USB_HOST_CLIENT_EVENT_NEW_DEV:
        Serial.printf("\n🔌 NEW USB DEVICE DETECTED!\n");
        Serial.printf("   Device Address: %d\n", eventMsg->new_dev.address);
        ESP_LOGI(TAG, "New USB device connected: address %d", eventMsg->new_dev.address);
        host->stats.devicesConnected++;
        host->stats.lastEventTime = millis();

        if (xSemaphoreTake(host->usbMutex, pdMS_TO_TICKS(100)) == pdTRUE)
        {
            // Add to pending devices list for class driver to handle
            if (host->pendingDeviceCount < 16)
            {
                host->pendingDevices[host->pendingDeviceCount] = eventMsg->new_dev.address;
                host->pendingDeviceCount++;
                Serial.printf("   Added to pending devices list (count: %d)\n", host->pendingDeviceCount);
            }
            else
            {
                Serial.printf("   ⚠️ Pending devices list full!\n");
            }
            xSemaphoreGive(host->usbMutex);
        }
        break;

    case USB_HOST_CLIENT_EVENT_DEV_GONE:
        Serial.printf("\n📤 USB DEVICE DISCONNECTED\n");
        ESP_LOGI(TAG, "USB device disconnected");
        host->stats.devicesDisconnected++;
        host->stats.lastEventTime = millis();

        if (xSemaphoreTake(host->usbMutex, pdMS_TO_TICKS(100)) == pdTRUE)
        {
            host->classDriverActionCloseDev();
            xSemaphoreGive(host->usbMutex);
        }
        break;

    default:
        Serial.printf("\n❓ Unknown USB client event: %d\n", eventMsg->event);
        ESP_LOGW(TAG, "Unknown USB client event: %d", eventMsg->event);
        break;
    }
}

bool USBHostImpl::openDevice(uint8_t deviceAddress)
{
    ESP_LOGI(TAG, "Opening USB device at address %d", deviceAddress);

    usb_device_handle_t deviceHandle;
    esp_err_t err = usb_host_device_open(clientHandle, deviceAddress, &deviceHandle);
    if (err != ESP_OK)
    {
        ESP_LOGE(TAG, "Failed to open device: %s", esp_err_to_name(err));
        stats.errors++;
        return false;
    }

    // Update device info
    updateDeviceInfo(deviceHandle);

    // Set device as connected
    deviceInfo.deviceAddress = deviceAddress;
    deviceInfo.isConnected = true;
    deviceConnected = true;

    // Close device handle for now (would keep open for actual communication)
    usb_host_device_close(clientHandle, deviceHandle);

    ESP_LOGI(TAG, "USB device opened - VID: 0x%04X, PID: 0x%04X",
             deviceInfo.vid, deviceInfo.pid);

    return true;
}

void USBHostImpl::closeDevice()
{
    ESP_LOGI(TAG, "Closing USB device");

    deviceConnected = false;
    deviceInfo.isConnected = false;
    deviceInfo.deviceAddress = 0;
}

void USBHostImpl::updateDeviceInfo(usb_device_handle_t deviceHandle)
{
    const usb_device_desc_t *deviceDesc;
    esp_err_t err = usb_host_get_device_descriptor(deviceHandle, &deviceDesc);

    if (err == ESP_OK)
    {
        deviceInfo.vid = deviceDesc->idVendor;
        deviceInfo.pid = deviceDesc->idProduct;
        deviceInfo.vendor = getVendorName(deviceInfo.vid);
        deviceInfo.product = getProductName(deviceInfo.vid, deviceInfo.pid);
        deviceInfo.isFlightController = isFlightControllerDevice(deviceInfo.vid, deviceInfo.pid);

        ESP_LOGI(TAG, "Device info - VID: 0x%04X, PID: 0x%04X, Vendor: %s, Product: %s",
                 deviceInfo.vid, deviceInfo.pid,
                 deviceInfo.vendor.c_str(), deviceInfo.product.c_str());
    }
    else
    {
        ESP_LOGE(TAG, "Failed to get device descriptor: %s", esp_err_to_name(err));
        stats.errors++;
    }
}

bool USBHostImpl::isFlightControllerDevice(uint16_t vid, uint16_t pid)
{
    // Check flight controller database
    for (const FlightControllerUSB *fc = known_flight_controllers; fc->vendor != nullptr; fc++)
    {
        if (fc->vid == vid && fc->pid == pid)
        {
            return true;
        }
    }

    // Check for common USB-to-serial adapters used by flight controllers
    return (vid == 0x0403) || // FTDI
           (vid == 0x10C4) || // Silicon Labs CP210x
           (vid == 0x1A86) || // WCH CH340/CH341
           (vid == 0x0483) || // STMicroelectronics
           (vid == 0x16C0);   // PJRC Teensy
}

const char *USBHostImpl::getVendorName(uint16_t vid)
{
    // Check flight controller database
    for (const FlightControllerUSB *fc = known_flight_controllers; fc->vendor != nullptr; fc++)
    {
        if (fc->vid == vid)
        {
            return fc->vendor;
        }
    }

    // Common vendor names
    switch (vid)
    {
    case 0x0403:
        return "FTDI";
    case 0x10C4:
        return "Silicon Labs";
    case 0x1A86:
        return "WCH";
    case 0x0483:
        return "STMicroelectronics";
    case 0x16C0:
        return "PJRC";
    default:
        return "Unknown";
    }
}

const char *USBHostImpl::getProductName(uint16_t vid, uint16_t pid)
{
    // Check flight controller database
    for (const FlightControllerUSB *fc = known_flight_controllers; fc->vendor != nullptr; fc++)
    {
        if (fc->vid == vid && fc->pid == pid)
        {
            return fc->product;
        }
    }

    return "Unknown Device";
}

void USBHostImpl::handleEvents()
{
    // Process events from event queue
    USBHostEventMessage eventMsg;
    while (xQueueReceive(eventQueue, &eventMsg, 0) == pdTRUE)
    {
        switch (eventMsg.event)
        {
        case USB_HOST_DEVICE_CONNECTED:
            ESP_LOGI(TAG, "Processing device connected event");
            Serial.printf("🔗 USB Host: Processing device connected event\n");
            break;
        case USB_HOST_DEVICE_DISCONNECTED:
            ESP_LOGI(TAG, "Processing device disconnected event");
            Serial.printf("💔 USB Host: Processing device disconnected event\n");
            break;
        case USB_HOST_DATA_RECEIVED:
            ESP_LOGD(TAG, "📥 DATA RECEIVED: %d bytes (buffer count: %d)", eventMsg.data_len, rxBufferCount);
            ESP_LOGD(TAG, "📥 USB Host: Received %d bytes, buffer count: %d", eventMsg.data_len, rxBufferCount);

            // Log first few bytes for debugging (verbose level only)
            if (esp_log_level_get(TAG) >= ESP_LOG_VERBOSE && eventMsg.data_len > 0)
            {
                ESP_LOGV(TAG, "First bytes: 0x%02X 0x%02X 0x%02X 0x%02X 0x%02X 0x%02X 0x%02X 0x%02X",
                         eventMsg.data_len > 0 ? eventMsg.data[0] : 0,
                         eventMsg.data_len > 1 ? eventMsg.data[1] : 0,
                         eventMsg.data_len > 2 ? eventMsg.data[2] : 0,
                         eventMsg.data_len > 3 ? eventMsg.data[3] : 0,
                         eventMsg.data_len > 4 ? eventMsg.data[4] : 0,
                         eventMsg.data_len > 5 ? eventMsg.data[5] : 0,
                         eventMsg.data_len > 6 ? eventMsg.data[6] : 0,
                         eventMsg.data_len > 7 ? eventMsg.data[7] : 0);
            }

            // Process received data
            if (eventMsg.data_len > 0 && eventMsg.data_len <= USB_OTG_BUFFER_SIZE)
            {
                // Copy data to rx buffer
                for (size_t i = 0; i < eventMsg.data_len && rxBufferCount < USB_OTG_BUFFER_SIZE; i++)
                {
                    rxBuffer[rxBufferHead] = eventMsg.data[i];
                    rxBufferHead = (rxBufferHead + 1) % USB_OTG_BUFFER_SIZE;
                    rxBufferCount++;
                }
                stats.bytesReceived += eventMsg.data_len;
                stats.messagesReceived++;
                stats.lastActivity = millis();

                ESP_LOGD(TAG, "✅ Data copied to rx buffer. Total received: %lu bytes", stats.bytesReceived);
                ESP_LOGD(TAG, "✅ USB Host: Data copied to buffer. Total: %lu bytes", stats.bytesReceived);
            }
            else
            {
                ESP_LOGW(TAG, "⚠️ Invalid data length: %d", eventMsg.data_len);
                Serial.printf("⚠️ USB Host: Invalid data length: %d\n", eventMsg.data_len);
            }
            break;
        case USB_HOST_ERROR:
            ESP_LOGW(TAG, "Processing error event");
            Serial.printf("❌ USB Host: Processing error event\n");
            stats.errors++;
            break;
        }
    }
}

// Communication interface methods
size_t USBHostImpl::available()
{
    if (xSemaphoreTake(usbMutex, pdMS_TO_TICKS(10)) == pdTRUE)
    {
        size_t count = rxBufferCount;
        xSemaphoreGive(usbMutex);
        return count;
    }
    return 0;
}

size_t USBHostImpl::write(const uint8_t *data, size_t len)
{
    if (!deviceConnected || !transfersActive || len == 0)
    {
        return 0;
    }

    if (xSemaphoreTake(usbMutex, pdMS_TO_TICKS(100)) == pdTRUE)
    {
        // Wait for previous transfer to complete
        if (bulkOutTransferInProgress)
        {
            xSemaphoreGive(usbMutex);
            if (xSemaphoreTake(transferCompleteSemaphore, pdMS_TO_TICKS(transferTimeoutMs)) != pdTRUE)
            {
                ESP_LOGW(TAG, "Transfer timeout");
                return 0;
            }
            if (xSemaphoreTake(usbMutex, pdMS_TO_TICKS(100)) != pdTRUE)
            {
                return 0;
            }
        }

        // Copy data to transfer buffer
        size_t writeLen = (len > USB_OTG_BUFFER_SIZE) ? USB_OTG_BUFFER_SIZE : len;
        memcpy(bulkOutTransfer->data_buffer, data, writeLen);
        bulkOutTransfer->num_bytes = writeLen;

        // Submit transfer
        bulkOutTransferInProgress = true;
        esp_err_t err = usb_host_transfer_submit(bulkOutTransfer);

        xSemaphoreGive(usbMutex);

        if (err != ESP_OK)
        {
            ESP_LOGE(TAG, "Failed to submit bulk out transfer: %s", esp_err_to_name(err));
            bulkOutTransferInProgress = false;
            stats.errors++;
            return 0;
        }

        stats.bytesSent += writeLen;
        stats.messagesSent++;
        stats.lastActivity = millis();
        return writeLen;
    }

    return 0;
}

size_t USBHostImpl::read(uint8_t *buffer, size_t len)
{
    if (!buffer || len == 0)
    {
        return 0;
    }

    if (xSemaphoreTake(usbMutex, pdMS_TO_TICKS(10)) == pdTRUE)
    {
        size_t readLen = 0;

        while (readLen < len && rxBufferCount > 0)
        {
            buffer[readLen] = rxBuffer[rxBufferTail];
            rxBufferTail = (rxBufferTail + 1) % USB_OTG_BUFFER_SIZE;
            rxBufferCount--;
            readLen++;
        }

        xSemaphoreGive(usbMutex);
        return readLen;
    }

    return 0;
}

int USBHostImpl::read()
{
    uint8_t byte;
    if (read(&byte, 1) == 1)
    {
        return byte;
    }
    return -1;
}

void USBHostImpl::flush()
{
    // Wait for any pending transfers to complete
    if (bulkOutTransferInProgress)
    {
        xSemaphoreTake(transferCompleteSemaphore, pdMS_TO_TICKS(transferTimeoutMs));
    }
}

bool USBHostImpl::setBaudRate(uint32_t baud_rate)
{
    if (baud_rate > 0)
    {
        baudRate = baud_rate;
        ESP_LOGI(TAG, "Baud rate set to %lu", baudRate);
        return true;
    }
    return false;
}

// USB transfer callbacks
void USBHostImpl::bulkInTransferCallback(usb_transfer_t *transfer)
{
    USBHostImpl *host = static_cast<USBHostImpl *>(transfer->context);

    ESP_LOGD(TAG, "🔄 Bulk IN transfer callback - Status: %d, Bytes: %d",
             transfer->status, transfer->actual_num_bytes);
    ESP_LOGD(TAG, "🔄 USB Transfer IN: Status=%d, Bytes=%d",
             transfer->status, transfer->actual_num_bytes);

    if (transfer->status == USB_TRANSFER_STATUS_COMPLETED)
    {
        // Process received data
        if (transfer->actual_num_bytes > 0)
        {
            ESP_LOGD(TAG, "📨 Bulk IN received %d bytes", transfer->actual_num_bytes);
            ESP_LOGD(TAG, "📨 USB: Received %d bytes from FC", transfer->actual_num_bytes);

            // Log first few bytes for debugging (verbose level only)
            if (esp_log_level_get(TAG) >= ESP_LOG_VERBOSE)
            {
                uint8_t *buffer = (uint8_t *)transfer->data_buffer;
                ESP_LOGV(TAG, "Data: 0x%02X 0x%02X 0x%02X 0x%02X 0x%02X 0x%02X 0x%02X 0x%02X",
                         transfer->actual_num_bytes > 0 ? buffer[0] : 0,
                         transfer->actual_num_bytes > 1 ? buffer[1] : 0,
                         transfer->actual_num_bytes > 2 ? buffer[2] : 0,
                         transfer->actual_num_bytes > 3 ? buffer[3] : 0,
                         transfer->actual_num_bytes > 4 ? buffer[4] : 0,
                         transfer->actual_num_bytes > 5 ? buffer[5] : 0,
                         transfer->actual_num_bytes > 6 ? buffer[6] : 0,
                         transfer->actual_num_bytes > 7 ? buffer[7] : 0);
            }

            USBHostEventMessage eventMsg;
            eventMsg.event = USB_HOST_DATA_RECEIVED;
            eventMsg.device_address = host->deviceInfo.deviceAddress;
            eventMsg.data_len = transfer->actual_num_bytes;
            memcpy(eventMsg.data, transfer->data_buffer, transfer->actual_num_bytes);

            // Send event to queue
            BaseType_t queueResult = xQueueSend(host->eventQueue, &eventMsg, 0);
            if (queueResult == pdTRUE)
            {
                ESP_LOGD(TAG, "✅ USB: Data event queued successfully");
                // Reset failure counter on successful data reception
                host->consecutiveTransferFailures = 0;
            }
            else
            {
                ESP_LOGW(TAG, "⚠️ Failed to queue data event - queue full");
            }
        }
        else
        {
            ESP_LOGD(TAG, "🔄 Bulk IN transfer completed with 0 bytes");
        }

        // Resubmit transfer for continuous reception
        if (host->transfersActive)
        {
            esp_err_t err = usb_host_transfer_submit(transfer);
            if (err != ESP_OK)
            {
                ESP_LOGE(TAG, "❌ Failed to resubmit bulk in transfer: %s", esp_err_to_name(err));
                Serial.printf("❌ USB: Failed to resubmit transfer: %s\n", esp_err_to_name(err));
                host->stats.errors++;
            }
            else
            {
                ESP_LOGD(TAG, "🔄 Bulk IN transfer resubmitted successfully");
                // Reset failure counter on successful resubmission
                host->consecutiveTransferFailures = 0;
            }
        }
        else
        {
            ESP_LOGW(TAG, "⚠️ Transfers not active - not resubmitting");
            Serial.printf("⚠️ USB: Transfers not active - stopping reception\n");
        }
    }
    else
    {
        ESP_LOGW(TAG, "❌ Bulk in transfer failed with status: %d", transfer->status);
        Serial.printf("❌ USB: Transfer failed with status: %d\n", transfer->status);
        host->stats.errors++;

        // Handle transfer failure and possibly trigger recovery
        host->handleTransferFailure();

        // Try to resubmit on certain errors if not attempting recovery
        if (host->transfersActive && !host->shouldAttemptRecovery() &&
            (transfer->status == USB_TRANSFER_STATUS_TIMED_OUT ||
             transfer->status == USB_TRANSFER_STATUS_STALL))
        {
            ESP_LOGI(TAG, "🔄 Attempting to resubmit after error");
            Serial.printf("🔄 USB: Attempting to resubmit after error\n");
            esp_err_t err = usb_host_transfer_submit(transfer);
            if (err != ESP_OK)
            {
                ESP_LOGE(TAG, "❌ Failed to resubmit after error: %s", esp_err_to_name(err));
            }
        }
    }
}

void USBHostImpl::bulkOutTransferCallback(usb_transfer_t *transfer)
{
    USBHostImpl *host = static_cast<USBHostImpl *>(transfer->context);

    if (transfer->status == USB_TRANSFER_STATUS_COMPLETED)
    {
        ESP_LOGD(TAG, "Bulk out transfer completed: %d bytes", transfer->actual_num_bytes);
    }
    else
    {
        ESP_LOGW(TAG, "Bulk out transfer failed with status: %d", transfer->status);
        host->stats.errors++;
    }

    // Signal transfer completion
    host->bulkOutTransferInProgress = false;
    xSemaphoreGive(host->transferCompleteSemaphore);
}

// Class driver task (based on ESP-IDF example)
void USBHostImpl::classDriverTask(void *arg)
{
    USBHostImpl *host = static_cast<USBHostImpl *>(arg);
    ESP_LOGI(TAG, "Class driver task started");
    Serial.printf("🎯 Class driver task started - processing device events...\n");

    uint32_t taskCounter = 0;

    while (host->initialized)
    {
        taskCounter++;

        // Handle pending device actions
        if (host->pendingDeviceCount > 0)
        {
            Serial.printf("⚡ Processing %d pending devices...\n", host->pendingDeviceCount);

            for (int i = 0; i < host->pendingDeviceCount; i++)
            {
                uint8_t devAddr = host->pendingDevices[i];
                Serial.printf("   Processing device at address %d\n", devAddr);
                ESP_LOGI(TAG, "Processing pending device at address %d", devAddr);

                if (host->classDriverActionOpenDev(devAddr))
                {
                    Serial.printf("   ✅ Device %d processed successfully\n", devAddr);
                    // Remove from pending list
                    for (int j = i; j < host->pendingDeviceCount - 1; j++)
                    {
                        host->pendingDevices[j] = host->pendingDevices[j + 1];
                    }
                    host->pendingDeviceCount--;
                    i--; // Adjust index after removal
                }
                else
                {
                    Serial.printf("   ❌ Failed to process device %d\n", devAddr);
                }
            }
        }

        // Print status every 10 seconds
        // if (taskCounter % 100 == 0)
        // {
        //     Serial.printf("🔄 Class driver task alive (cycle %lu), pending devices: %d\n",
        //                   taskCounter, host->pendingDeviceCount);
        // }

        vTaskDelay(pdMS_TO_TICKS(100));
    }

    ESP_LOGI(TAG, "Class driver task ending");
    vTaskDelete(nullptr);
}

bool USBHostImpl::enumerationFilterCallback(const usb_device_desc_t *device_desc, uint8_t *bConfigurationValue)
{
    ESP_LOGI(TAG, "Enumeration filter: VID=0x%04X, PID=0x%04X", device_desc->idVendor, device_desc->idProduct);

    // Accept all CDC devices for now
    // In a more sophisticated implementation, we could filter by device class
    *bConfigurationValue = 1; // Use configuration 1
    return true;              // Accept the device
}

// Class driver action methods
bool USBHostImpl::classDriverActionOpenDev(uint8_t dev_addr)
{
    Serial.printf("\n🔓 Opening USB device at address %d\n", dev_addr);
    ESP_LOGI(TAG, "Class driver opening device at address %d", dev_addr);

    esp_err_t err = usb_host_device_open(clientHandle, dev_addr, &deviceHandle);
    if (err != ESP_OK)
    {
        ESP_LOGE(TAG, "Failed to open device: %s", esp_err_to_name(err));
        Serial.printf("❌ Failed to open device: %s\n", esp_err_to_name(err));
        return false;
    }

    Serial.printf("✅ Device opened successfully\n");

    // Get device info
    updateDeviceInfo(deviceHandle);
    deviceInfo.deviceAddress = dev_addr;
    deviceInfo.isConnected = true;
    deviceConnected = true;

    Serial.printf("\n🎯 DETECTED FLIGHT CONTROLLER:\n");
    Serial.printf("📋 Device Info: VID=0x%04X, PID=0x%04X\n", deviceInfo.vid, deviceInfo.pid);
    Serial.printf("   Vendor: %s\n", deviceInfo.vendor.c_str());
    Serial.printf("   Product: %s\n", deviceInfo.product.c_str());
    Serial.printf("   Flight Controller: %s\n", deviceInfo.isFlightController ? "YES" : "NO");

    // Add specific FC detection info
    if (deviceInfo.vid == 0x0483 && deviceInfo.pid == 0x5740)
    {
        Serial.printf("   🎯 Detected: STM32 DFU Mode\n");
    }
    else if (deviceInfo.vid == 0x0483 && deviceInfo.pid == 0xa0da)
    {
        Serial.printf("   🎯 Detected: STM32 Virtual COM Port\n");
    }
    else if (deviceInfo.vid == 0x1209 && deviceInfo.pid == 0x53c0)
    {
        Serial.printf("   🎯 Detected: Betaflight/iNav STM32\n");
    }
    else if (deviceInfo.vid == 0x1209 && deviceInfo.pid == 0x53c1)
    {
        Serial.printf("   🎯 Detected: Betaflight/iNav STM32 (Bootloader)\n");
    }
    else if (deviceInfo.vid == 0x0403)
    {
        Serial.printf("   🎯 Detected: FTDI USB-Serial adapter\n");
    }
    else if (deviceInfo.vid == 0x10c4)
    {
        Serial.printf("   🎯 Detected: Silicon Labs CP210x\n");
    }
    else if (deviceInfo.vid == 0x1a86)
    {
        Serial.printf("   🎯 Detected: WCH CH340/CH341\n");
    }
    else
    {
        Serial.printf("   ⚠️ Unknown flight controller type\n");
    }
    Serial.printf("\n");

    // Initialize CDC communication
    if (initializeCDCCommunication())
    {
        ESP_LOGI(TAG, "CDC communication initialized successfully");
        Serial.printf("🚁 CDC communication initialized successfully\n");
    }
    else
    {
        ESP_LOGW(TAG, "Failed to initialize CDC communication");
        Serial.printf("⚠️ Failed to initialize CDC communication\n");
    }

    return true;
}

bool USBHostImpl::classDriverActionGetInfo()
{
    if (!deviceHandle)
    {
        return false;
    }

    ESP_LOGI(TAG, "Getting device information");
    updateDeviceInfo(deviceHandle);
    return true;
}

bool USBHostImpl::classDriverActionGetDesc()
{
    if (!deviceHandle)
    {
        return false;
    }

    ESP_LOGI(TAG, "Getting device descriptor");
    // Device descriptor is already retrieved in updateDeviceInfo
    return true;
}

bool USBHostImpl::classDriverActionGetConfigDesc()
{
    if (!deviceHandle)
    {
        return false;
    }

    ESP_LOGI(TAG, "Getting configuration descriptor");
    // Configuration descriptor handling would go here
    return true;
}

bool USBHostImpl::classDriverActionGetStrDesc()
{
    if (!deviceHandle)
    {
        return false;
    }

    ESP_LOGI(TAG, "Getting string descriptors");
    // String descriptor handling would go here
    return true;
}

bool USBHostImpl::classDriverActionCloseDev()
{
    if (!deviceHandle)
    {
        return false;
    }

    ESP_LOGI(TAG, "Closing device");

    // Stop transfers
    stopUSBTransfers();

    // Close device
    esp_err_t err = usb_host_device_close(clientHandle, deviceHandle);
    if (err != ESP_OK)
    {
        ESP_LOGE(TAG, "Failed to close device: %s", esp_err_to_name(err));
    }

    deviceHandle = nullptr;
    deviceConnected = false;
    deviceInfo.isConnected = false;

    return true;
}

// CDC-ACM communication methods
bool USBHostImpl::initializeCDCCommunication()
{
    if (!deviceHandle)
    {
        ESP_LOGE(TAG, "No device handle for CDC communication");
        return false;
    }

    ESP_LOGI(TAG, "Initializing CDC-ACM communication");

    // Find USB endpoints
    if (!findUSBEndpoints())
    {
        ESP_LOGE(TAG, "Failed to find USB endpoints");
        return false;
    }

    // Validate endpoints before setting up transfers
    if (!validateEndpoints())
    {
        ESP_LOGE(TAG, "❌ Endpoint validation failed - cannot setup transfers");
        Serial.printf("❌ USB: Endpoint validation failed\n");
        return false;
    }

    // Setup USB transfers
    if (!setupUSBTransfers())
    {
        ESP_LOGE(TAG, "Failed to setup USB transfers");
        return false;
    }

    // Start CDC transfers
    startCDCTransfers();

    ESP_LOGI(TAG, "CDC-ACM communication initialized");
    return true;
}

void USBHostImpl::startCDCTransfers()
{
    ESP_LOGI(TAG, "🚀 Attempting to start CDC transfers");
    Serial.printf("🚀 USB: Starting CDC transfers...\n");

    if (!transfersActive && bulkInTransfer && bulkOutTransfer)
    {
        ESP_LOGI(TAG, "✅ Prerequisites met - starting transfers");
        Serial.printf("✅ USB: Transfer prerequisites met\n");
        Serial.printf("   - transfersActive: %s\n", transfersActive ? "true" : "false");
        Serial.printf("   - bulkInTransfer: %p\n", bulkInTransfer);
        Serial.printf("   - bulkOutTransfer: %p\n", bulkOutTransfer);

        transfersActive = true;

        // Submit bulk in transfer for receiving data
        ESP_LOGI(TAG, "📥 Submitting bulk IN transfer for data reception");
        Serial.printf("📥 USB: Submitting bulk IN transfer (endpoint: 0x%02X)\n", bulkInEpAddr);

        esp_err_t err = usb_host_transfer_submit(bulkInTransfer);
        if (err != ESP_OK)
        {
            ESP_LOGE(TAG, "❌ Failed to submit bulk in transfer: %s", esp_err_to_name(err));
            Serial.printf("❌ USB: Failed to submit bulk IN transfer: %s\n", esp_err_to_name(err));
            transfersActive = false;
        }
        else
        {
            ESP_LOGI(TAG, "✅ Bulk IN transfer submitted successfully");
            Serial.printf("✅ USB: Bulk IN transfer submitted - ready to receive data!\n");
        }
    }
    else
    {
        ESP_LOGW(TAG, "⚠️ Cannot start CDC transfers - prerequisites not met");
        Serial.printf("⚠️ USB: Cannot start transfers:\n");
        Serial.printf("   - transfersActive: %s\n", transfersActive ? "true" : "false");
        Serial.printf("   - bulkInTransfer: %p\n", bulkInTransfer);
        Serial.printf("   - bulkOutTransfer: %p\n", bulkOutTransfer);
    }
}

bool USBHostImpl::findUSBEndpoints()
{
    if (!deviceHandle)
    {
        ESP_LOGE(TAG, "❌ No device handle for endpoint detection");
        Serial.printf("❌ USB: No device handle for endpoint detection\n");
        return false;
    }

    ESP_LOGI(TAG, "🔍 Finding USB endpoints");
    Serial.printf("🔍 USB: Searching for CDC endpoints...\n");

    // Get configuration descriptor
    const usb_config_desc_t *configDesc;
    esp_err_t err = usb_host_get_active_config_descriptor(deviceHandle, &configDesc);
    if (err != ESP_OK)
    {
        ESP_LOGE(TAG, "❌ Failed to get config descriptor: %s", esp_err_to_name(err));
        Serial.printf("❌ USB: Failed to get config descriptor: %s\n", esp_err_to_name(err));
        return false;
    }

    ESP_LOGI(TAG, "✅ Got configuration descriptor");
    Serial.printf("✅ USB: Got configuration descriptor\n");
    Serial.printf("   - Interfaces: %d\n", configDesc->bNumInterfaces);
    Serial.printf("   - Config value: %d\n", configDesc->bConfigurationValue);

    // Parse descriptors to find actual endpoints
    bool endpointsFound = false;
    bulkInEpAddr = 0;
    bulkOutEpAddr = 0;

    const uint8_t *desc_ptr = (const uint8_t *)configDesc;
    const uint8_t *desc_end = desc_ptr + configDesc->wTotalLength;

    Serial.printf("🔍 USB: Parsing %d byte configuration descriptor...\n", configDesc->wTotalLength);
    Serial.printf("📋 USB: Detailed descriptor analysis:\n");

    int interfaceCount = 0;
    int endpointCount = 0;
    int currentInterface = -1;

    while (desc_ptr < desc_end)
    {
        const usb_standard_desc_t *desc = (const usb_standard_desc_t *)desc_ptr;

        if (desc->bLength == 0)
        {
            Serial.printf("⚠️ USB: Zero-length descriptor encountered, stopping parse\n");
            break;
        }

        Serial.printf("   📄 Descriptor: Type=0x%02X, Length=%d\n", desc->bDescriptorType, desc->bLength);

        switch (desc->bDescriptorType)
        {
        case USB_B_DESCRIPTOR_TYPE_INTERFACE:
        {
            const usb_intf_desc_t *intf_desc = (const usb_intf_desc_t *)desc;
            currentInterface = intf_desc->bInterfaceNumber;
            interfaceCount++;

            Serial.printf("   🔌 Interface %d:\n", currentInterface);
            Serial.printf("      - Class: 0x%02X\n", intf_desc->bInterfaceClass);
            Serial.printf("      - SubClass: 0x%02X\n", intf_desc->bInterfaceSubClass);
            Serial.printf("      - Protocol: 0x%02X\n", intf_desc->bInterfaceProtocol);
            Serial.printf("      - Endpoints: %d\n", intf_desc->bNumEndpoints);

            // Check for CDC-ACM class
            if (intf_desc->bInterfaceClass == 0x02)
            { // CDC Communication
                Serial.printf("      ✅ CDC Communication Interface\n");
            }
            else if (intf_desc->bInterfaceClass == 0x0A)
            { // CDC Data
                Serial.printf("      ✅ CDC Data Interface\n");
            }
            break;
        }

        case USB_B_DESCRIPTOR_TYPE_ENDPOINT:
        {
            const usb_ep_desc_t *ep_desc = (const usb_ep_desc_t *)desc;
            endpointCount++;

            Serial.printf("   📍 Endpoint %d (Interface %d): 0x%02X\n",
                          endpointCount, currentInterface, ep_desc->bEndpointAddress);
            Serial.printf("      - Type: 0x%02X (", ep_desc->bmAttributes & 0x03);

            switch (ep_desc->bmAttributes & 0x03)
            {
            case 0x00:
                Serial.printf("Control");
                break;
            case 0x01:
                Serial.printf("Isochronous");
                break;
            case 0x02:
                Serial.printf("Bulk");
                break;
            case 0x03:
                Serial.printf("Interrupt");
                break;
            }
            Serial.printf(")\n");

            Serial.printf("      - Direction: %s\n", (ep_desc->bEndpointAddress & 0x80) ? "IN" : "OUT");
            Serial.printf("      - Max packet: %d bytes\n", ep_desc->wMaxPacketSize);
            Serial.printf("      - Interval: %d\n", ep_desc->bInterval);

            // Look for bulk endpoints
            if ((ep_desc->bmAttributes & 0x03) == 0x02)
            { // Bulk transfer
                Serial.printf("      🚀 BULK ENDPOINT FOUND!\n");
                if (ep_desc->bEndpointAddress & 0x80)
                { // IN endpoint
                    if (bulkInEpAddr == 0)
                    {
                        bulkInEpAddr = ep_desc->bEndpointAddress;
                        ESP_LOGI(TAG, "✅ Selected bulk IN endpoint: 0x%02X (Interface %d)",
                                 bulkInEpAddr, currentInterface);
                        Serial.printf("      ✅ SELECTED as bulk IN endpoint!\n");
                    }
                    else
                    {
                        Serial.printf("      ⚠️ Additional bulk IN found but already have one\n");
                    }
                }
                else
                { // OUT endpoint
                    if (bulkOutEpAddr == 0)
                    {
                        bulkOutEpAddr = ep_desc->bEndpointAddress;
                        ESP_LOGI(TAG, "✅ Selected bulk OUT endpoint: 0x%02X (Interface %d)",
                                 bulkOutEpAddr, currentInterface);
                        Serial.printf("      ✅ SELECTED as bulk OUT endpoint!\n");
                    }
                    else
                    {
                        Serial.printf("      ⚠️ Additional bulk OUT found but already have one\n");
                    }
                }
            }
            break;
        }

        default:
            Serial.printf("   📄 Other descriptor (Type 0x%02X)\n", desc->bDescriptorType);
            break;
        }

        desc_ptr += desc->bLength;
    }

    Serial.printf("📊 USB Descriptor Summary:\n");
    Serial.printf("   - Interfaces found: %d\n", interfaceCount);
    Serial.printf("   - Endpoints found: %d\n", endpointCount);
    Serial.printf("   - Bulk IN selected: 0x%02X\n", bulkInEpAddr);
    Serial.printf("   - Bulk OUT selected: 0x%02X\n", bulkOutEpAddr);

    // Check if we found both endpoints
    if (bulkInEpAddr != 0 && bulkOutEpAddr != 0)
    {
        endpointsFound = true;
        ESP_LOGI(TAG, "✅ Found both bulk endpoints via descriptor parsing");
        Serial.printf("✅ USB: Found both endpoints via parsing!\n");
    }
    else
    {
        ESP_LOGW(TAG, "⚠️ Could not find both endpoints, falling back to defaults");
        Serial.printf("⚠️ USB: Could not find both endpoints, using defaults\n");
        Serial.printf("   Found: IN=0x%02X, OUT=0x%02X\n", bulkInEpAddr, bulkOutEpAddr);

        // Fallback to common defaults
        if (bulkInEpAddr == 0)
            bulkInEpAddr = 0x81;
        if (bulkOutEpAddr == 0)
            bulkOutEpAddr = 0x02;

        Serial.printf("   Using: IN=0x%02X, OUT=0x%02X\n", bulkInEpAddr, bulkOutEpAddr);
    }

    // Strategy: Try to claim the interface that contains our bulk endpoints
    ESP_LOGI(TAG, "🤝 Attempting to claim interface");
    Serial.printf("🤝 USB: Claiming interface...\n");

    // If we found endpoints, try to find which interface they belong to
    int targetInterface = -1;
    if (bulkInEpAddr != 0 || bulkOutEpAddr != 0)
    {
        // Re-parse to find which interface contains our endpoints
        const uint8_t *desc_ptr2 = (const uint8_t *)configDesc;
        const uint8_t *desc_end2 = desc_ptr2 + configDesc->wTotalLength;
        int currentIntf = -1;

        while (desc_ptr2 < desc_end2)
        {
            const usb_standard_desc_t *desc2 = (const usb_standard_desc_t *)desc_ptr2;
            if (desc2->bLength == 0)
                break;

            if (desc2->bDescriptorType == USB_B_DESCRIPTOR_TYPE_INTERFACE)
            {
                const usb_intf_desc_t *intf_desc2 = (const usb_intf_desc_t *)desc2;
                currentIntf = intf_desc2->bInterfaceNumber;
            }
            else if (desc2->bDescriptorType == USB_B_DESCRIPTOR_TYPE_ENDPOINT)
            {
                const usb_ep_desc_t *ep_desc2 = (const usb_ep_desc_t *)desc2;
                if (ep_desc2->bEndpointAddress == bulkInEpAddr ||
                    ep_desc2->bEndpointAddress == bulkOutEpAddr)
                {
                    if (targetInterface == -1)
                    {
                        targetInterface = currentIntf;
                        Serial.printf("🎯 USB: Found endpoints in interface %d\n", targetInterface);
                    }
                }
            }
            desc_ptr2 += desc2->bLength;
        }
    }

    // Try to claim the target interface first, then fall back to trying all
    std::vector<int> interfacesToTry;
    if (targetInterface >= 0)
    {
        interfacesToTry.push_back(targetInterface);
    }

    // Add all other interfaces as fallbacks
    for (int i = 0; i < configDesc->bNumInterfaces; i++)
    {
        if (i != targetInterface)
        {
            interfacesToTry.push_back(i);
        }
    }

    for (int interface_num : interfacesToTry)
    {
        Serial.printf("🔄 USB: Trying to claim interface %d...\n", interface_num);
        err = usb_host_interface_claim(clientHandle, deviceHandle, interface_num, 0);
        if (err == ESP_OK)
        {
            ESP_LOGI(TAG, "✅ Claimed interface %d successfully", interface_num);
            Serial.printf("✅ USB: Interface %d claimed successfully\n", interface_num);
            deviceInfo.interfaceNumber = interface_num;

            // If this is not our target interface, we may need to re-scan for endpoints
            if (interface_num != targetInterface && (bulkInEpAddr == 0 || bulkOutEpAddr == 0))
            {
                Serial.printf("⚠️ USB: Claimed different interface, may need to rescan endpoints\n");
            }

            ESP_LOGI(TAG, "📍 Using endpoints - IN: 0x%02X, OUT: 0x%02X", bulkInEpAddr, bulkOutEpAddr);
            Serial.printf("📍 USB: Final endpoints - IN: 0x%02X, OUT: 0x%02X\n", bulkInEpAddr, bulkOutEpAddr);
            return true;
        }
        else
        {
            ESP_LOGW(TAG, "⚠️ Failed to claim interface %d: %s", interface_num, esp_err_to_name(err));
            Serial.printf("⚠️ USB: Failed to claim interface %d: %s\n", interface_num, esp_err_to_name(err));
        }
    }

    ESP_LOGE(TAG, "❌ Failed to claim any interface");
    Serial.printf("❌ USB: Could not claim any interface\n");
    return false;
}

bool USBHostImpl::setupUSBTransfers()
{
    ESP_LOGI(TAG, "🔧 Setting up USB transfers");
    Serial.printf("🔧 USB: Setting up transfers...\n");

    if (!deviceHandle || bulkInEpAddr == 0 || bulkOutEpAddr == 0)
    {
        ESP_LOGE(TAG, "❌ Invalid parameters for USB transfer setup");
        Serial.printf("❌ USB: Invalid transfer parameters:\n");
        Serial.printf("   - deviceHandle: %p\n", deviceHandle);
        Serial.printf("   - bulkInEpAddr: 0x%02X\n", bulkInEpAddr);
        Serial.printf("   - bulkOutEpAddr: 0x%02X\n", bulkOutEpAddr);
        return false;
    }

    Serial.printf("✅ USB: Transfer parameters valid\n");
    Serial.printf("   - Buffer size: %d bytes\n", USB_OTG_BUFFER_SIZE);

    // Allocate bulk IN transfer
    ESP_LOGI(TAG, "📥 Allocating bulk IN transfer (%d bytes)", USB_OTG_BUFFER_SIZE);
    Serial.printf("📥 USB: Allocating bulk IN transfer (%d bytes)...\n", USB_OTG_BUFFER_SIZE);

    esp_err_t err = usb_host_transfer_alloc(USB_OTG_BUFFER_SIZE, 0, &bulkInTransfer);
    if (err != ESP_OK)
    {
        ESP_LOGE(TAG, "❌ Failed to allocate bulk IN transfer: %s", esp_err_to_name(err));
        Serial.printf("❌ USB: Failed to allocate bulk IN transfer: %s\n", esp_err_to_name(err));
        return false;
    }

    ESP_LOGI(TAG, "✅ Bulk IN transfer allocated at %p", bulkInTransfer);
    Serial.printf("✅ USB: Bulk IN transfer allocated\n");

    // Configure bulk IN transfer
    bulkInTransfer->device_handle = deviceHandle;
    bulkInTransfer->bEndpointAddress = bulkInEpAddr;
    bulkInTransfer->callback = bulkInTransferCallback;
    bulkInTransfer->context = this;
    bulkInTransfer->num_bytes = USB_OTG_BUFFER_SIZE;

    Serial.printf("📋 USB: Bulk IN transfer configured:\n");
    Serial.printf("   - Endpoint: 0x%02X\n", bulkInEpAddr);
    Serial.printf("   - Buffer size: %d bytes\n", USB_OTG_BUFFER_SIZE);
    Serial.printf("   - Callback: %p\n", bulkInTransferCallback);

    // Allocate bulk OUT transfer
    ESP_LOGI(TAG, "📤 Allocating bulk OUT transfer (%d bytes)", USB_OTG_BUFFER_SIZE);
    Serial.printf("📤 USB: Allocating bulk OUT transfer...\n");

    err = usb_host_transfer_alloc(USB_OTG_BUFFER_SIZE, 0, &bulkOutTransfer);
    if (err != ESP_OK)
    {
        ESP_LOGE(TAG, "❌ Failed to allocate bulk OUT transfer: %s", esp_err_to_name(err));
        Serial.printf("❌ USB: Failed to allocate bulk OUT transfer: %s\n", esp_err_to_name(err));
        usb_host_transfer_free(bulkInTransfer);
        bulkInTransfer = nullptr;
        return false;
    }

    ESP_LOGI(TAG, "✅ Bulk OUT transfer allocated at %p", bulkOutTransfer);
    Serial.printf("✅ USB: Bulk OUT transfer allocated\n");

    // Configure bulk OUT transfer
    bulkOutTransfer->device_handle = deviceHandle;
    bulkOutTransfer->bEndpointAddress = bulkOutEpAddr;
    bulkOutTransfer->callback = bulkOutTransferCallback;
    bulkOutTransfer->context = this;

    Serial.printf("📋 USB: Bulk OUT transfer configured:\n");
    Serial.printf("   - Endpoint: 0x%02X\n", bulkOutEpAddr);
    Serial.printf("   - Callback: %p\n", bulkOutTransferCallback);

    ESP_LOGI(TAG, "✅ USB transfers setup completed successfully");
    Serial.printf("✅ USB: All transfers configured successfully!\n");
    return true;
}

void USBHostImpl::stopUSBTransfers()
{
    ESP_LOGI(TAG, "Stopping USB transfers");

    transfersActive = false;

    // Free transfers
    if (bulkInTransfer)
    {
        usb_host_transfer_free(bulkInTransfer);
        bulkInTransfer = nullptr;
    }

    if (bulkOutTransfer)
    {
        usb_host_transfer_free(bulkOutTransfer);
        bulkOutTransfer = nullptr;
    }

    bulkInEpAddr = 0;
    bulkOutEpAddr = 0;
    bulkOutTransferInProgress = false;
}

void USBHostImpl::logUSBEvent(const char *event, const char *details)
{
    if (details)
    {
        ESP_LOGI(TAG, "USB Event: %s - %s", event, details);
    }
    else
    {
        ESP_LOGI(TAG, "USB Event: %s", event);
    }
}

void USBHostImpl::handleTransferFailure()
{
    consecutiveTransferFailures++;
    lastTransferFailureTime = millis();

    ESP_LOGW(TAG, "🔥 USB Transfer failure #%lu", consecutiveTransferFailures);
    Serial.printf("🔥 USB: Transfer failure #%lu\n", consecutiveTransferFailures);

    if (shouldAttemptRecovery())
    {
        ESP_LOGI(TAG, "🛠️ Attempting USB transfer recovery");
        Serial.printf("🛠️ USB: Attempting recovery...\n");
        performRecovery();
    }
}

bool USBHostImpl::shouldAttemptRecovery()
{
    // Only attempt recovery if we've had multiple consecutive failures
    // and enough time has passed since the last failure
    uint32_t now = millis();
    bool timeoutReached = (now - lastTransferFailureTime) >= RECOVERY_DELAY_MS;
    bool failureThresholdReached = consecutiveTransferFailures >= MAX_CONSECUTIVE_FAILURES;

    return failureThresholdReached && timeoutReached;
}

void USBHostImpl::performRecovery()
{
    ESP_LOGI(TAG, "🔄 USB Recovery: Restarting CDC transfers");
    Serial.printf("🔄 USB Recovery: Restarting CDC transfers\n");

    // Stop current transfers
    stopUSBTransfers();

    // Wait a bit
    vTaskDelay(pdMS_TO_TICKS(500));

    // Try to reinitialize CDC communication
    if (deviceHandle && initializeCDCCommunication())
    {
        ESP_LOGI(TAG, "✅ USB Recovery: CDC communication restarted");
        Serial.printf("✅ USB Recovery: Success!\n");
        consecutiveTransferFailures = 0; // Reset failure counter
    }
    else
    {
        ESP_LOGE(TAG, "❌ USB Recovery: Failed to restart CDC communication");
        Serial.printf("❌ USB Recovery: Failed\n");
    }
}

bool USBHostImpl::validateEndpoint(uint8_t endpointAddr)
{
    if (!deviceHandle || !clientHandle)
    {
        ESP_LOGW(TAG, "⚠️ Cannot validate endpoint - no device handle");
        Serial.printf("⚠️ USB: Cannot validate endpoint - no device handle\n");
        return false;
    }

    ESP_LOGI(TAG, "🔍 Validating endpoint 0x%02X", endpointAddr);
    Serial.printf("🔍 USB: Validating endpoint 0x%02X...\n", endpointAddr);

    // Try to get endpoint handle to verify it exists
    // Note: This is a simplified validation - in a full implementation,
    // you would check against the actual interface descriptors

    // For now, just log that we're attempting validation
    Serial.printf("   - Endpoint address: 0x%02X\n", endpointAddr);
    Serial.printf("   - Direction: %s\n", (endpointAddr & 0x80) ? "IN" : "OUT");
    Serial.printf("   - Number: %d\n", endpointAddr & 0x0F);

    // Basic validation - endpoint address should be non-zero and valid
    if (endpointAddr == 0)
    {
        ESP_LOGW(TAG, "❌ Invalid endpoint address: 0x%02X", endpointAddr);
        Serial.printf("❌ USB: Invalid endpoint address: 0x%02X\n", endpointAddr);
        return false;
    }

    // Endpoint number should be 1-15
    uint8_t epNum = endpointAddr & 0x0F;
    if (epNum == 0 || epNum > 15)
    {
        ESP_LOGW(TAG, "❌ Invalid endpoint number: %d", epNum);
        Serial.printf("❌ USB: Invalid endpoint number: %d\n", epNum);
        return false;
    }

    ESP_LOGI(TAG, "✅ Endpoint 0x%02X appears valid", endpointAddr);
    Serial.printf("✅ USB: Endpoint 0x%02X appears valid\n", endpointAddr);
    return true;
}

bool USBHostImpl::validateEndpoints()
{
    ESP_LOGI(TAG, "🔍 Validating selected endpoints");
    Serial.printf("🔍 USB: Validating selected endpoints...\n");

    bool inValid = validateEndpoint(bulkInEpAddr);
    bool outValid = validateEndpoint(bulkOutEpAddr);

    if (inValid && outValid)
    {
        ESP_LOGI(TAG, "✅ Both endpoints validated successfully");
        Serial.printf("✅ USB: Both endpoints validated successfully\n");
        return true;
    }
    else
    {
        ESP_LOGW(TAG, "❌ Endpoint validation failed - IN:%s OUT:%s",
                 inValid ? "OK" : "FAIL", outValid ? "OK" : "FAIL");
        Serial.printf("❌ USB: Endpoint validation failed - IN:%s OUT:%s\n",
                      inValid ? "OK" : "FAIL", outValid ? "OK" : "FAIL");
        return false;
    }
}

#endif // CONFIG_IDF_TARGET_ESP32S3