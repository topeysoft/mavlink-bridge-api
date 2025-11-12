#pragma once

#ifdef ARDUINO_ARCH_NATIVE

#include "FS.h"

// LittleFS is just an alias for FS in our mock
#define LittleFS_Class FS

extern FS LittleFS;

#endif // ARDUINO_ARCH_NATIVE