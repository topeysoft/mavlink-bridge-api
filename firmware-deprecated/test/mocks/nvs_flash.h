#pragma once

#ifdef ARDUINO_ARCH_NATIVE

#include <cstddef>

// NVS types
typedef void* nvs_handle_t;
typedef int esp_err_t;

// Error codes
#define ESP_OK                          0
#define ESP_ERR_NVS_NOT_INITIALIZED     0x1101
#define ESP_ERR_NVS_NOT_FOUND          0x1102
#define ESP_ERR_NVS_TYPE_MISMATCH      0x1103
#define ESP_ERR_NVS_READ_ONLY          0x1104
#define ESP_ERR_NVS_NOT_ENOUGH_SPACE   0x1105
#define ESP_ERR_NVS_INVALID_NAME       0x1106
#define ESP_ERR_NVS_INVALID_HANDLE     0x1107
#define ESP_ERR_NVS_REMOVE_FAILED      0x1108
#define ESP_ERR_NVS_KEY_TOO_LONG       0x1109
#define ESP_ERR_NVS_PAGE_FULL          0x110A

// NVS access modes
typedef enum {
    NVS_READONLY,
    NVS_READWRITE
} nvs_open_mode_t;

// Mock NVS functions (minimal implementation for testing)
esp_err_t nvs_flash_init(void);
esp_err_t nvs_flash_erase(void);
esp_err_t nvs_open(const char* name, nvs_open_mode_t open_mode, nvs_handle_t *out_handle);
void nvs_close(nvs_handle_t handle);
esp_err_t nvs_set_str(nvs_handle_t handle, const char* key, const char* value);
esp_err_t nvs_get_str(nvs_handle_t handle, const char* key, char* out_value, size_t* length);
esp_err_t nvs_set_i32(nvs_handle_t handle, const char* key, int32_t value);
esp_err_t nvs_get_i32(nvs_handle_t handle, const char* key, int32_t* out_value);
esp_err_t nvs_set_u8(nvs_handle_t handle, const char* key, uint8_t value);
esp_err_t nvs_get_u8(nvs_handle_t handle, const char* key, uint8_t* out_value);
esp_err_t nvs_set_blob(nvs_handle_t handle, const char* key, const void* value, size_t length);
esp_err_t nvs_get_blob(nvs_handle_t handle, const char* key, void* out_value, size_t* length);
esp_err_t nvs_erase_key(nvs_handle_t handle, const char* key);
esp_err_t nvs_erase_all(nvs_handle_t handle);
esp_err_t nvs_commit(nvs_handle_t handle);

#endif // ARDUINO_ARCH_NATIVE