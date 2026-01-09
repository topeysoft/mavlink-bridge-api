Import("env")
import os
import subprocess

def merge_binaries(source, target, env):
    """Merge bootloader, partition table, and application binaries for QEMU"""
    
    build_dir = env.subst("$BUILD_DIR")
    
    # Binary paths
    bootloader_bin = os.path.join(build_dir, "bootloader.bin")
    partitions_bin = os.path.join(build_dir, "partitions.bin")
    app_bin = os.path.join(build_dir, "firmware.bin")
    merged_bin = os.path.join(build_dir, "qemu_flash_image.bin")
    
    # Flash offsets (standard ESP32-S3)
    bootloader_offset = 0x1000
    partitions_offset = 0x8000
    app_offset = 0x10000
    flash_size = 16 * 1024 * 1024  # 16MB
    
    print("Merging binaries for QEMU...")
    
    try:
        # Create empty flash image
        with open(merged_bin, 'wb') as f:
            f.write(b'\xFF' * flash_size)
        
        # Write bootloader if exists
        if os.path.exists(bootloader_bin):
            with open(merged_bin, 'r+b') as f:
                with open(bootloader_bin, 'rb') as b:
                    f.seek(bootloader_offset)
                    f.write(b.read())
            print(f"  - Bootloader at 0x{bootloader_offset:x}")
        
        # Write partition table
        if os.path.exists(partitions_bin):
            with open(merged_bin, 'r+b') as f:
                with open(partitions_bin, 'rb') as p:
                    f.seek(partitions_offset)
                    f.write(p.read())
            print(f"  - Partition table at 0x{partitions_offset:x}")
        
        # Write application
        if os.path.exists(app_bin):
            with open(merged_bin, 'r+b') as f:
                with open(app_bin, 'rb') as a:
                    f.seek(app_offset)
                    f.write(a.read())
            print(f"  - Application at 0x{app_offset:x}")
        
        print(f"Merged binary created: {merged_bin}")
        
        # Create QEMU run script
        qemu_script = os.path.join(build_dir, "run_qemu.sh")
        with open(qemu_script, 'w') as f:
            f.write(f"""#!/bin/bash
# Run ESP32-S3 in QEMU
# Note: This assumes QEMU for ESP32 is installed and in PATH
# You can also use: idf.py qemu monitor
qemu-system-xtensa \\
    -nographic \\
    -M esp32s3 \\
    -drive file={merged_bin},if=mtd,format=raw \\
    -serial stdio
""")
        os.chmod(qemu_script, 0o755)
        print(f"QEMU run script created: {qemu_script}")
        
    except Exception as e:
        print(f"Error merging binaries: {e}")
        env.Exit(1)

# Register post-build action
env.AddPostAction("$BUILD_DIR/firmware.bin", merge_binaries)