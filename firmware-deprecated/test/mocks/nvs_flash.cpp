#ifdef ARDUINO_ARCH_NATIVE

#include "nvs_flash.h"
#include <map>
#include <string>
#include <cstring>

// Mock NVS storage
static std::map<std::string, std::map<std::string, std::string>> nvs_storage;
static bool nvs_initialized = false;

esp_err_t nvs_flash_init(void) {
    nvs_initialized = true;
    return ESP_OK;
}

esp_err_t nvs_flash_erase(void) {
    nvs_storage.clear();
    return ESP_OK;
}

esp_err_t nvs_open(const char* name, nvs_open_mode_t open_mode, nvs_handle_t *out_handle) {
    (void)open_mode;
    if (!nvs_initialized) return ESP_ERR_NVS_NOT_INITIALIZED;
    if (!name || !out_handle) return ESP_ERR_NVS_INVALID_NAME;
    
    // Use namespace name as handle (simple mock)
    *out_handle = (nvs_handle_t)strdup(name);
    return ESP_OK;
}

void nvs_close(nvs_handle_t handle) {
    if (handle) {
        free(handle);
    }
}

esp_err_t nvs_set_str(nvs_handle_t handle, const char* key, const char* value) {
    if (!handle || !key || !value) return ESP_ERR_NVS_INVALID_HANDLE;
    if (strlen(key) > 15) return ESP_ERR_NVS_KEY_TOO_LONG;
    
    std::string ns_name = (char*)handle;
    nvs_storage[ns_name][key] = value;
    return ESP_OK;
}

esp_err_t nvs_get_str(nvs_handle_t handle, const char* key, char* out_value, size_t* length) {
    if (!handle || !key || !length) return ESP_ERR_NVS_INVALID_HANDLE;
    
    std::string ns_name = (char*)handle;
    auto ns_it = nvs_storage.find(ns_name);
    if (ns_it == nvs_storage.end()) return ESP_ERR_NVS_NOT_FOUND;
    
    auto key_it = ns_it->second.find(key);
    if (key_it == ns_it->second.end()) return ESP_ERR_NVS_NOT_FOUND;
    
    size_t required_size = key_it->second.length() + 1;
    if (!out_value) {
        *length = required_size;
        return ESP_OK;
    }
    
    if (*length < required_size) return ESP_ERR_NVS_NOT_ENOUGH_SPACE;
    
    strcpy(out_value, key_it->second.c_str());
    *length = required_size;
    return ESP_OK;
}

esp_err_t nvs_set_i32(nvs_handle_t handle, const char* key, int32_t value) {
    return nvs_set_str(handle, key, std::to_string(value).c_str());
}

esp_err_t nvs_get_i32(nvs_handle_t handle, const char* key, int32_t* out_value) {
    if (!out_value) return ESP_ERR_NVS_INVALID_HANDLE;
    
    char buffer[32];
    size_t length = sizeof(buffer);
    esp_err_t result = nvs_get_str(handle, key, buffer, &length);
    if (result == ESP_OK) {
        *out_value = std::stoi(buffer);
    }
    return result;
}

esp_err_t nvs_set_u8(nvs_handle_t handle, const char* key, uint8_t value) {
    return nvs_set_str(handle, key, std::to_string(value).c_str());
}

esp_err_t nvs_get_u8(nvs_handle_t handle, const char* key, uint8_t* out_value) {
    if (!out_value) return ESP_ERR_NVS_INVALID_HANDLE;
    
    char buffer[8];
    size_t length = sizeof(buffer);
    esp_err_t result = nvs_get_str(handle, key, buffer, &length);
    if (result == ESP_OK) {
        *out_value = static_cast<uint8_t>(std::stoi(buffer));
    }
    return result;
}

esp_err_t nvs_set_blob(nvs_handle_t handle, const char* key, const void* value, size_t length) {
    if (!handle || !key || !value) return ESP_ERR_NVS_INVALID_HANDLE;
    if (strlen(key) > 15) return ESP_ERR_NVS_KEY_TOO_LONG;
    
    std::string ns_name = (char*)handle;
    nvs_storage[ns_name][key] = std::string((const char*)value, length);
    return ESP_OK;
}

esp_err_t nvs_get_blob(nvs_handle_t handle, const char* key, void* out_value, size_t* length) {
    if (!handle || !key || !length) return ESP_ERR_NVS_INVALID_HANDLE;
    
    std::string ns_name = (char*)handle;
    auto ns_it = nvs_storage.find(ns_name);
    if (ns_it == nvs_storage.end()) return ESP_ERR_NVS_NOT_FOUND;
    
    auto key_it = ns_it->second.find(key);
    if (key_it == ns_it->second.end()) return ESP_ERR_NVS_NOT_FOUND;
    
    size_t required_size = key_it->second.length();
    if (!out_value) {
        *length = required_size;
        return ESP_OK;
    }
    
    if (*length < required_size) return ESP_ERR_NVS_NOT_ENOUGH_SPACE;
    
    memcpy(out_value, key_it->second.data(), required_size);
    *length = required_size;
    return ESP_OK;
}

esp_err_t nvs_erase_key(nvs_handle_t handle, const char* key) {
    if (!handle || !key) return ESP_ERR_NVS_INVALID_HANDLE;
    
    std::string ns_name = (char*)handle;
    auto ns_it = nvs_storage.find(ns_name);
    if (ns_it == nvs_storage.end()) return ESP_ERR_NVS_NOT_FOUND;
    
    auto key_it = ns_it->second.find(key);
    if (key_it == ns_it->second.end()) return ESP_ERR_NVS_NOT_FOUND;
    
    ns_it->second.erase(key_it);
    return ESP_OK;
}

esp_err_t nvs_erase_all(nvs_handle_t handle) {
    if (!handle) return ESP_ERR_NVS_INVALID_HANDLE;
    
    std::string ns_name = (char*)handle;
    nvs_storage[ns_name].clear();
    return ESP_OK;
}

esp_err_t nvs_commit(nvs_handle_t handle) {
    (void)handle;
    return ESP_OK;
}

#endif // ARDUINO_ARCH_NATIVE