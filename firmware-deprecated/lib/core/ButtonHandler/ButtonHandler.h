#pragma once

#include <Arduino.h>
#include <functional>

/**
 * ButtonHandler - Manages physical button input with debouncing and long press detection
 *
 * Features:
 * - Debounced button press detection
 * - Long press detection
 * - Callback functions for button events
 * - Non-blocking operation
 */
class ButtonHandler
{
public:
    // Button event types
    enum EventType
    {
        PRESS,      // Short press (released before long press threshold)
        LONG_PRESS, // Long press detected
        RELEASE     // Button released
    };

    // Callback function type
    using ButtonCallback = std::function<void(EventType)>;

private:
    static ButtonHandler *instance;

    // Configuration
    uint8_t buttonPin;
    bool pullupEnabled;
    unsigned long debounceDelay;
    unsigned long longPressDelay;

    // State tracking
    bool lastButtonState;
    bool buttonState;
    unsigned long lastDebounceTime;
    unsigned long buttonPressTime;
    bool longPressTriggered;
    bool enabled;

    // Callback
    ButtonCallback callback;

    // Constructor (private for singleton)
    ButtonHandler();

public:
    ~ButtonHandler();

    // Get singleton instance
    static ButtonHandler *getInstance();

    /**
     * Initialize button handler
     * @param pin GPIO pin number for button
     * @param enablePullup Enable internal pullup resistor
     * @param debounceMs Debounce delay in milliseconds (default: 50)
     * @param longPressMs Long press threshold in milliseconds (default: 3000)
     */
    void begin(uint8_t pin, bool enablePullup = true,
               unsigned long debounceMs = 50,
               unsigned long longPressMs = 3000);

    /**
     * Set callback function for button events
     * @param cb Callback function to call on button events
     */
    void setCallback(ButtonCallback cb);

    /**
     * Update button state - call this in loop() or from a task
     */
    void update();

    /**
     * Enable or disable button handling
     */
    void setEnabled(bool enable);

    /**
     * Check if button is currently pressed
     */
    bool isPressed() const;

    /**
     * Get current button state
     */
    bool getState() const { return buttonState; }

    /**
     * Get time button has been held (in milliseconds)
     */
    unsigned long getHoldDuration() const;
};
