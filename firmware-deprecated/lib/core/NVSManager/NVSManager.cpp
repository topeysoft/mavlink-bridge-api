#include "NVSManager.h"
#include <ArduinoJson.h>
#include <nvs_flash.h>

// Static member definitions
NVSManager *NVSManager::instance = nullptr;

const char *NVSManager::NAMESPACE_SYSTEM = "system";
const char *NVSManager::NAMESPACE_WIFI = "wifi";
const char *NVSManager::NAMESPACE_DEVICE = "device";

const char *NVSManager::KEY_DEVICE_NAME = "dev_name";
const char *NVSManager::KEY_DEVICE_ID = "dev_id";
const char *NVSManager::KEY_MDNS_HOSTNAME = "mdns_host";
const char *NVSManager::KEY_CONFIG_VERSION = "cfg_ver";

const char *NVSManager::KEY_WIFI_SSID = "ssid";
const char *NVSManager::KEY_WIFI_PASS = "password";
const char *NVSManager::KEY_WIFI_AUTO_CONNECT = "auto_conn";

NVSManager::NVSManager() : isInitialized(false)
{
}

NVSManager::~NVSManager()
{
    end();
}

NVSManager *NVSManager::getInstance()
{
    if (instance == nullptr)
    {
        instance = new NVSManager();
    }
    return instance;
}

NVSResult NVSManager::begin()
{
    if (isInitialized)
    {
        return NVSResult::SUCCESS;
    }

    Serial.println("NVSManager::begin() - Initializing NVS flash");

    // Initialize NVS flash first
    esp_err_t err = nvs_flash_init();
    if (err == ESP_ERR_NVS_NO_FREE_PAGES || err == ESP_ERR_NVS_NEW_VERSION_FOUND)
    {
        // NVS partition was truncated and needs to be erased
        Serial.println("NVSManager::begin() - Erasing NVS flash and retrying...");
        nvs_flash_erase();
        err = nvs_flash_init();
    }

    if (err != ESP_OK)
    {
        setLastError("Failed to initialize NVS flash: " + String(esp_err_to_name(err)));
        Serial.printf("NVSManager::begin() - ERROR: NVS flash init failed: %s\n", esp_err_to_name(err));
        return NVSResult::NOT_INITIALIZED;
    }

    Serial.println("NVSManager::begin() - NVS flash initialized successfully");
    Serial.println("NVSManager::begin() - NVS initialized successfully");
    isInitialized = true;
    return NVSResult::SUCCESS;
}

void NVSManager::end()
{
    if (!isInitialized)
    {
        return;
    }

    preferences.end();
    isInitialized = false;
}

// Generic storage operations
NVSResult NVSManager::putString(const String &key, const String &value, const String &ns)
{
    if (!isInitialized)
    {
        setLastError("NVS not initialized");
        return NVSResult::NOT_INITIALIZED;
    }

    if (key.length() > MAX_KEY_LENGTH)
    {
        setLastError("Key too long");
        return NVSResult::INVALID_KEY;
    }

    String namespace_name = ns.isEmpty() ? NAMESPACE_SYSTEM : ns;
    if (!openNamespace(namespace_name, false))
    {
        return NVSResult::INVALID_NAMESPACE;
    }

    size_t result = preferences.putString(key.c_str(), value);
    closeNamespace();

    if (result == 0)
    {
        setLastError("Failed to write string");
        return NVSResult::WRITE_FAILED;
    }

    return NVSResult::SUCCESS;
}

NVSResult NVSManager::getString(const String &key, String &value, const String &ns)
{
    if (!isInitialized)
    {
        setLastError("NVS not initialized");
        return NVSResult::NOT_INITIALIZED;
    }

    String namespace_name = ns.isEmpty() ? NAMESPACE_SYSTEM : ns;
    if (!openNamespace(namespace_name, true))
    {
        return NVSResult::INVALID_NAMESPACE;
    }

    value = preferences.getString(key.c_str(), "");
    closeNamespace();

    if (value.isEmpty() && !hasKey(key, ns))
    {
        setLastError("Key not found");
        return NVSResult::KEY_NOT_FOUND;
    }

    return NVSResult::SUCCESS;
}

NVSResult NVSManager::putInt(const String &key, int32_t value, const String &ns)
{
    if (!isInitialized)
    {
        setLastError("NVS not initialized");
        return NVSResult::NOT_INITIALIZED;
    }

    if (key.length() > MAX_KEY_LENGTH)
    {
        setLastError("Key too long");
        return NVSResult::INVALID_KEY;
    }

    String namespace_name = ns.isEmpty() ? NAMESPACE_SYSTEM : ns;
    if (!openNamespace(namespace_name, false))
    {
        return NVSResult::INVALID_NAMESPACE;
    }

    size_t result = preferences.putInt(key.c_str(), value);
    closeNamespace();

    if (result == 0)
    {
        setLastError("Failed to write int");
        return NVSResult::WRITE_FAILED;
    }

    return NVSResult::SUCCESS;
}

NVSResult NVSManager::getInt(const String &key, int32_t &value, const String &ns)
{
    if (!isInitialized)
    {
        setLastError("NVS not initialized");
        return NVSResult::NOT_INITIALIZED;
    }

    String namespace_name = ns.isEmpty() ? NAMESPACE_SYSTEM : ns;
    if (!openNamespace(namespace_name, true))
    {
        return NVSResult::INVALID_NAMESPACE;
    }

    if (!preferences.isKey(key.c_str()))
    {
        closeNamespace();
        setLastError("Key not found");
        return NVSResult::KEY_NOT_FOUND;
    }

    value = preferences.getInt(key.c_str(), 0);
    closeNamespace();

    return NVSResult::SUCCESS;
}

NVSResult NVSManager::putBool(const String &key, bool value, const String &ns)
{
    if (!isInitialized)
    {
        setLastError("NVS not initialized");
        return NVSResult::NOT_INITIALIZED;
    }

    if (key.length() > MAX_KEY_LENGTH)
    {
        setLastError("Key too long");
        return NVSResult::INVALID_KEY;
    }

    String namespace_name = ns.isEmpty() ? NAMESPACE_SYSTEM : ns;
    if (!openNamespace(namespace_name, false))
    {
        return NVSResult::INVALID_NAMESPACE;
    }

    size_t result = preferences.putBool(key.c_str(), value);
    closeNamespace();

    if (result == 0)
    {
        setLastError("Failed to write bool");
        return NVSResult::WRITE_FAILED;
    }

    return NVSResult::SUCCESS;
}

NVSResult NVSManager::getBool(const String &key, bool &value, const String &ns)
{
    if (!isInitialized)
    {
        setLastError("NVS not initialized");
        return NVSResult::NOT_INITIALIZED;
    }

    String namespace_name = ns.isEmpty() ? NAMESPACE_SYSTEM : ns;
    if (!openNamespace(namespace_name, true))
    {
        return NVSResult::INVALID_NAMESPACE;
    }

    if (!preferences.isKey(key.c_str()))
    {
        closeNamespace();
        setLastError("Key not found");
        return NVSResult::KEY_NOT_FOUND;
    }

    value = preferences.getBool(key.c_str(), false);
    closeNamespace();

    return NVSResult::SUCCESS;
}

NVSResult NVSManager::putBytes(const String &key, const uint8_t *data, size_t length, const String &ns)
{
    if (!isInitialized)
    {
        setLastError("NVS not initialized");
        return NVSResult::NOT_INITIALIZED;
    }

    if (key.length() > MAX_KEY_LENGTH)
    {
        setLastError("Key too long");
        return NVSResult::INVALID_KEY;
    }

    String namespace_name = ns.isEmpty() ? NAMESPACE_SYSTEM : ns;
    if (!openNamespace(namespace_name, false))
    {
        return NVSResult::INVALID_NAMESPACE;
    }

    size_t result = preferences.putBytes(key.c_str(), data, length);
    closeNamespace();

    if (result == 0)
    {
        setLastError("Failed to write bytes");
        return NVSResult::WRITE_FAILED;
    }

    return NVSResult::SUCCESS;
}

NVSResult NVSManager::getBytes(const String &key, uint8_t *buffer, size_t &length, const String &ns)
{
    if (!isInitialized)
    {
        setLastError("NVS not initialized");
        return NVSResult::NOT_INITIALIZED;
    }

    String namespace_name = ns.isEmpty() ? NAMESPACE_SYSTEM : ns;
    if (!openNamespace(namespace_name, true))
    {
        return NVSResult::INVALID_NAMESPACE;
    }

    if (!preferences.isKey(key.c_str()))
    {
        closeNamespace();
        setLastError("Key not found");
        return NVSResult::KEY_NOT_FOUND;
    }

    length = preferences.getBytes(key.c_str(), buffer, length);
    closeNamespace();

    if (length == 0)
    {
        setLastError("Failed to read bytes");
        return NVSResult::READ_FAILED;
    }

    return NVSResult::SUCCESS;
}

NVSResult NVSManager::remove(const String &key, const String &ns)
{
    if (!isInitialized)
    {
        setLastError("NVS not initialized");
        return NVSResult::NOT_INITIALIZED;
    }

    String namespace_name = ns.isEmpty() ? NAMESPACE_SYSTEM : ns;
    if (!openNamespace(namespace_name, false))
    {
        return NVSResult::INVALID_NAMESPACE;
    }

    bool result = preferences.remove(key.c_str());
    closeNamespace();

    if (!result)
    {
        setLastError("Failed to remove key");
        return NVSResult::KEY_NOT_FOUND;
    }

    return NVSResult::SUCCESS;
}

NVSResult NVSManager::clear(const String &ns)
{
    if (!isInitialized)
    {
        setLastError("NVS not initialized");
        return NVSResult::NOT_INITIALIZED;
    }

    String namespace_name = ns.isEmpty() ? NAMESPACE_SYSTEM : ns;
    if (!openNamespace(namespace_name, false))
    {
        return NVSResult::INVALID_NAMESPACE;
    }

    bool result = preferences.clear();
    closeNamespace();

    if (!result)
    {
        setLastError("Failed to clear namespace");
        return NVSResult::WRITE_FAILED;
    }

    return NVSResult::SUCCESS;
}

// WiFi credential management
NVSResult NVSManager::saveWiFiCredential(const WiFiCredential &credential)
{
    if (!isInitialized)
    {
        setLastError("NVS not initialized");
        return NVSResult::NOT_INITIALIZED;
    }

    if (credential.ssid.isEmpty())
    {
        setLastError("Invalid SSID");
        return NVSResult::INVALID_VALUE;
    }

    // Save single credential
    if (!openNamespace(NAMESPACE_WIFI, false))
    {
        return NVSResult::INVALID_NAMESPACE;
    }

    preferences.putString(KEY_WIFI_SSID, credential.ssid);
    preferences.putString(KEY_WIFI_PASS, credential.password);

    closeNamespace();

    Serial.printf("NVSManager: Saved WiFi credential for %s\n", credential.ssid.c_str());
    return NVSResult::SUCCESS;
}

NVSResult NVSManager::getWiFiCredential(WiFiCredential &credential)
{
    if (!isInitialized)
    {
        setLastError("NVS not initialized");
        return NVSResult::NOT_INITIALIZED;
    }

    if (!openNamespace(NAMESPACE_WIFI, true))
    {
        return NVSResult::INVALID_NAMESPACE;
    }

    credential.ssid = preferences.getString(KEY_WIFI_SSID, "");
    credential.password = preferences.getString(KEY_WIFI_PASS, "");

    closeNamespace();

    if (credential.ssid.isEmpty())
    {
        setLastError("No WiFi credential stored");
        return NVSResult::KEY_NOT_FOUND;
    }

    return NVSResult::SUCCESS;
}

NVSResult NVSManager::removeWiFiCredential()
{
    if (!isInitialized)
    {
        setLastError("NVS not initialized");
        return NVSResult::NOT_INITIALIZED;
    }

    if (!openNamespace(NAMESPACE_WIFI, false))
    {
        return NVSResult::INVALID_NAMESPACE;
    }

    // Remove credential
    preferences.remove(KEY_WIFI_SSID);
    preferences.remove(KEY_WIFI_PASS);

    closeNamespace();

    Serial.println("NVSManager: Removed WiFi credential");
    return NVSResult::SUCCESS;
}

bool NVSManager::hasWiFiCredential()
{
    if (!isInitialized)
    {
        return false;
    }

    if (!openNamespace(NAMESPACE_WIFI, true))
    {
        return false;
    }

    bool hasCredential = preferences.isKey(KEY_WIFI_SSID) &&
                         !preferences.getString(KEY_WIFI_SSID, "").isEmpty();

    closeNamespace();

    return hasCredential;
}

// System configuration
NVSResult NVSManager::setDeviceName(const String &name)
{
    return putString(KEY_DEVICE_NAME, name, NAMESPACE_DEVICE);
}

NVSResult NVSManager::getDeviceName(String &name)
{
    return getString(KEY_DEVICE_NAME, name, NAMESPACE_DEVICE);
}

NVSResult NVSManager::setDeviceId(const String &id)
{
    return putString(KEY_DEVICE_ID, id, NAMESPACE_DEVICE);
}

NVSResult NVSManager::getDeviceId(String &id)
{
    return getString(KEY_DEVICE_ID, id, NAMESPACE_DEVICE);
}

NVSResult NVSManager::setMDNSHostname(const String &hostname)
{
    return putString(KEY_MDNS_HOSTNAME, hostname, NAMESPACE_DEVICE);
}

NVSResult NVSManager::getMDNSHostname(String &hostname)
{
    return getString(KEY_MDNS_HOSTNAME, hostname, NAMESPACE_DEVICE);
}

NVSResult NVSManager::setConfigVersion(uint32_t version)
{
    return putInt(KEY_CONFIG_VERSION, version, NAMESPACE_SYSTEM);
}

NVSResult NVSManager::getConfigVersion(uint32_t &version)
{
    int32_t ver = 0;
    NVSResult result = getInt(KEY_CONFIG_VERSION, ver, NAMESPACE_SYSTEM);
    version = static_cast<uint32_t>(ver);
    return result;
}

NVSResult NVSManager::setAutoConnect(bool enabled)
{
    return putBool(KEY_WIFI_AUTO_CONNECT, enabled, NAMESPACE_WIFI);
}

NVSResult NVSManager::getAutoConnect(bool &enabled)
{
    return getBool(KEY_WIFI_AUTO_CONNECT, enabled, NAMESPACE_WIFI);
}

// Utility functions
bool NVSManager::hasKey(const String &key, const String &ns)
{
    if (!isInitialized)
    {
        return false;
    }

    String namespace_name = ns.isEmpty() ? NAMESPACE_SYSTEM : ns;
    if (!openNamespace(namespace_name, true))
    {
        return false;
    }

    bool exists = preferences.isKey(key.c_str());
    closeNamespace();

    return exists;
}

size_t NVSManager::getUsedEntries(const String &ns)
{
    if (!isInitialized)
    {
        return 0;
    }

    // Note: ESP32 Preferences doesn't provide direct entry count
    // This is an approximation based on namespace usage
    return 0; // Would need platform-specific implementation
}

size_t NVSManager::getFreeEntries()
{
    if (!isInitialized)
    {
        return 0;
    }

    // Note: ESP32 Preferences doesn't provide direct free entry count
    // This would need platform-specific NVS API calls
    return 0; // Would need platform-specific implementation
}

// Migration support
NVSResult NVSManager::migrateFromJSON(const String &jsonData)
{
    if (!isInitialized)
    {
        setLastError("NVS not initialized");
        return NVSResult::NOT_INITIALIZED;
    }

    DynamicJsonDocument doc(2048);
    DeserializationError error = deserializeJson(doc, jsonData);

    if (error)
    {
        setLastError("JSON parsing failed");
        return NVSResult::INVALID_VALUE;
    }

    // Migrate device settings
    if (doc.containsKey("device"))
    {
        JsonObject device = doc["device"];
        if (device.containsKey("name"))
        {
            setDeviceName(String(device["name"].as<const char *>()));
        }
        if (device.containsKey("id"))
        {
            setDeviceId(String(device["id"].as<const char *>()));
        }
    }

    // Migrate mDNS settings
    if (doc.containsKey("mdns"))
    {
        JsonObject mdns = doc["mdns"];
        if (mdns.containsKey("hostname"))
        {
            setMDNSHostname(String(mdns["hostname"].as<const char *>()));
        }
    }

    // Migrate WiFi credentials
    if (doc.containsKey("connection") && doc["connection"].containsKey("wifi"))
    {
        JsonObject wifi = doc["connection"]["wifi"];

        if (wifi.containsKey("autoConnect"))
        {
            setAutoConnect(wifi["autoConnect"].as<bool>());
        }

        // Handle both old format (networks array) and new format (single credential)
        if (wifi.containsKey("networks"))
        {
            // Migrate from old multi-network format - take the first network
            JsonArray networks = wifi["networks"];
            if (networks.size() > 0)
            {
                JsonObject network = networks[0];
                if (network.containsKey("ssid") && network.containsKey("password"))
                {
                    WiFiCredential cred;
                    cred.ssid = String(network["ssid"].as<const char *>());
                    cred.password = String(network["password"].as<const char *>());

                    if (!cred.ssid.isEmpty())
                    {
                        saveWiFiCredential(cred);
                    }
                }
            }
        }
        else if (wifi.containsKey("ssid") && wifi.containsKey("password"))
        {
            // New single credential format
            WiFiCredential cred;
            cred.ssid = String(wifi["ssid"].as<const char *>());
            cred.password = String(wifi["password"].as<const char *>());

            if (!cred.ssid.isEmpty())
            {
                saveWiFiCredential(cred);
            }
        }
    }

    // Save config version
    if (doc.containsKey("version"))
    {
        setConfigVersion(doc["version"].as<uint32_t>());
    }

    Serial.println("NVSManager: Migration from JSON completed");
    return NVSResult::SUCCESS;
}

NVSResult NVSManager::exportToJSON(String &jsonData)
{
    if (!isInitialized)
    {
        setLastError("NVS not initialized");
        return NVSResult::NOT_INITIALIZED;
    }

    DynamicJsonDocument doc(2048);

    // Export device settings
    JsonObject device = doc.createNestedObject("device");
    String value;

    if (getDeviceName(value) == NVSResult::SUCCESS)
    {
        device["name"] = value;
    }
    if (getDeviceId(value) == NVSResult::SUCCESS)
    {
        device["id"] = value;
    }

    // Export mDNS settings
    JsonObject mdns = doc.createNestedObject("mdns");
    if (getMDNSHostname(value) == NVSResult::SUCCESS)
    {
        mdns["hostname"] = value;
    }

    // Export WiFi settings
    JsonObject connection = doc.createNestedObject("connection");
    JsonObject wifi = connection.createNestedObject("wifi");

    bool autoConnect = true;
    getAutoConnect(autoConnect);
    wifi["autoConnect"] = autoConnect;

    // Export WiFi credential
    WiFiCredential cred;
    if (getWiFiCredential(cred) == NVSResult::SUCCESS)
    {
        wifi["ssid"] = cred.ssid;
        wifi["password"] = cred.password;
    }

    // Export version
    uint32_t version = 1;
    getConfigVersion(version);
    doc["version"] = version;

    // Serialize to string
    serializeJson(doc, jsonData);

    return NVSResult::SUCCESS;
}

// Private methods
bool NVSManager::openNamespace(const String &ns, bool readOnly)
{
    if (!preferences.begin(ns.c_str(), readOnly))
    {
        setLastError("Failed to open namespace: " + ns);
        return false;
    }
    return true;
}

void NVSManager::closeNamespace()
{
    preferences.end();
}
