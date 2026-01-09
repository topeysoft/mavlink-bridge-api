#include "ButtonHandler.h"

ButtonHandler *ButtonHandler::instance = nullptr;

ButtonHandler::ButtonHandler()
    : buttonPin(0), pullupEnabled(true), debounceDelay(50), longPressDelay(3000), lastButtonState(HIGH), buttonState(HIGH), lastDebounceTime(0), buttonPressTime(0), longPressTriggered(false), enabled(false), callback(nullptr)
{
}

ButtonHandler::~ButtonHandler()
{
}

ButtonHandler *ButtonHandler::getInstance()
{
    if (instance == nullptr)
    {
        instance = new ButtonHandler();
    }
    return instance;
}

void ButtonHandler::begin(uint8_t pin, bool enablePullup,
                          unsigned long debounceMs,
                          unsigned long longPressMs)
{
    buttonPin = pin;
    pullupEnabled = enablePullup;
    debounceDelay = debounceMs;
    longPressDelay = longPressMs;

    // Configure pin
    pinMode(buttonPin, pullupEnabled ? INPUT_PULLUP : INPUT);

    // Read initial state
    buttonState = digitalRead(buttonPin);
    lastButtonState = buttonState;

    enabled = true;

    Serial.printf("ButtonHandler: Initialized on GPIO%d (pullup: %s, debounce: %lums, long press: %lums)\n",
                  buttonPin, pullupEnabled ? "yes" : "no", debounceMs, longPressMs);
}

void ButtonHandler::setCallback(ButtonCallback cb)
{
    callback = cb;
}

void ButtonHandler::update()
{
    if (!enabled)
    {
        return;
    }

    // Read current pin state
    bool reading = digitalRead(buttonPin);

    // Active LOW when using pullup (button pressed = LOW)
    // Active HIGH when not using pullup (button pressed = HIGH)
    bool pressed = pullupEnabled ? (reading == LOW) : (reading == HIGH);
    bool lastPressed = pullupEnabled ? (lastButtonState == LOW) : (lastButtonState == HIGH);

    // If the reading has changed, reset debounce timer
    if (reading != lastButtonState)
    {
        lastDebounceTime = millis();
    }

    // Check if reading has been stable for debounce delay
    if ((millis() - lastDebounceTime) > debounceDelay)
    {
        // If button state has changed
        if (reading != buttonState)
        {
            buttonState = reading;

            // Button was just pressed
            if (pressed && !lastPressed)
            {
                buttonPressTime = millis();
                longPressTriggered = false;

                if (callback)
                {
                    callback(EventType::PRESS);
                }
            }
            // Button was just released
            else if (!pressed && lastPressed)
            {
                if (callback)
                {
                    callback(EventType::RELEASE);
                }
            }
        }

        // Check for long press while button is held
        if (pressed && !longPressTriggered)
        {
            unsigned long pressDuration = millis() - buttonPressTime;
            if (pressDuration >= longPressDelay)
            {
                longPressTriggered = true;

                if (callback)
                {
                    callback(EventType::LONG_PRESS);
                }
            }
        }
    }

    lastButtonState = reading;
}

void ButtonHandler::setEnabled(bool enable)
{
    enabled = enable;
}

bool ButtonHandler::isPressed() const
{
    if (!enabled)
    {
        return false;
    }

    bool reading = digitalRead(buttonPin);
    return pullupEnabled ? (reading == LOW) : (reading == HIGH);
}

unsigned long ButtonHandler::getHoldDuration() const
{
    if (!isPressed())
    {
        return 0;
    }

    return millis() - buttonPressTime;
}
