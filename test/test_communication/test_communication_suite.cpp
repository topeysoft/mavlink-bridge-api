#include <unity.h>

// Forward declarations of test functions
void run_mavlink_processor_tests();
void run_data_router_tests();

void setUp(void) {
    // Set up test
}

void tearDown(void) {
    // Clean up after test
}

int main(int argc, char **argv) {
    UNITY_BEGIN();
    
    // Run MAVLink processor tests
    run_mavlink_processor_tests();
    
    // Run data router tests
    run_data_router_tests();
    
    return UNITY_END();
}