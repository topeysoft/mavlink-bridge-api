#pragma once

#ifdef ARDUINO_ARCH_NATIVE

#include <cstdint>

// UART mock types and constants
typedef int uart_port_t;
#define UART_NUM_0 0
#define UART_NUM_1 1
#define UART_NUM_2 2

// UART configuration mock
typedef struct {
    int baud_rate;
    int data_bits;
    int parity;
    int stop_bits;
    int flow_ctrl;
    int rx_flow_ctrl_thresh;
    uint32_t source_clk;
} uart_config_t;

// UART parity constants
#define UART_PARITY_DISABLE 0
#define UART_PARITY_EVEN 1
#define UART_PARITY_ODD 2

// UART data bits
#define UART_DATA_5_BITS 5
#define UART_DATA_6_BITS 6
#define UART_DATA_7_BITS 7
#define UART_DATA_8_BITS 8

// UART stop bits
#define UART_STOP_BITS_1 1
#define UART_STOP_BITS_2 2

// UART flow control
#define UART_HW_FLOWCTRL_DISABLE 0
#define UART_HW_FLOWCTRL_RTS 1
#define UART_HW_FLOWCTRL_CTS 2
#define UART_HW_FLOWCTRL_CTS_RTS 3

// Mock UART functions
inline int uart_param_config(uart_port_t uart_num, const uart_config_t *uart_config) {
    (void)uart_num;
    (void)uart_config;
    return 0; // ESP_OK
}

inline int uart_set_pin(uart_port_t uart_num, int tx_io_num, int rx_io_num, int rts_io_num, int cts_io_num) {
    (void)uart_num;
    (void)tx_io_num;
    (void)rx_io_num;
    (void)rts_io_num;
    (void)cts_io_num;
    return 0; // ESP_OK
}

inline int uart_driver_install(uart_port_t uart_num, int rx_buffer_size, int tx_buffer_size, int queue_size, void* uart_queue, int intr_alloc_flags) {
    (void)uart_num;
    (void)rx_buffer_size;
    (void)tx_buffer_size;
    (void)queue_size;
    (void)uart_queue;
    (void)intr_alloc_flags;
    return 0; // ESP_OK
}

inline int uart_write_bytes(uart_port_t uart_num, const void* src, size_t size) {
    (void)uart_num;
    (void)src;
    return static_cast<int>(size); // Mock: assume all bytes written
}

inline int uart_read_bytes(uart_port_t uart_num, void* buf, uint32_t length, uint32_t ticks_to_wait) {
    (void)uart_num;
    (void)buf;
    (void)length;
    (void)ticks_to_wait;
    return 0; // Mock: no bytes read
}

inline int uart_get_buffered_data_len(uart_port_t uart_num, size_t* size) {
    (void)uart_num;
    *size = 0; // Mock: no buffered data
    return 0; // ESP_OK
}

inline int uart_flush(uart_port_t uart_num) {
    (void)uart_num;
    return 0; // ESP_OK
}

inline int uart_set_hw_flow_ctrl(uart_port_t uart_num, int flow_ctrl, uint8_t rx_thresh) {
    (void)uart_num;
    (void)flow_ctrl;
    (void)rx_thresh;
    return 0; // ESP_OK
}

#endif // ARDUINO_ARCH_NATIVE