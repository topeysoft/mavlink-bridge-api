Import("env")

# Add QEMU-specific build flags
env.Append(
    BUILD_FLAGS=[
        "-DQEMU_BUILD=1",
        "-DCONFIG_IDF_TARGET_ESP32S3=1"
    ]
)

print("QEMU build environment configured")