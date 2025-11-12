# ESP32-S3 QEMU Emulator with PlatformIO
FROM ubuntu:22.04

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    git \
    wget \
    python3 \
    python3-pip \
    python3-venv \
    libffi-dev \
    libssl-dev \
    libusb-1.0-0 \
    ninja-build \
    ccache \
    libglib2.0-0 \
    libpixman-1-0 \
    libsdl2-2.0-0 \
    libgcrypt20 \
    libgnutls30 \
    && rm -rf /var/lib/apt/lists/*

# Create Python symlink
RUN ln -s /usr/bin/python3 /usr/bin/python

# Install PlatformIO
RUN python3 -m pip install --upgrade pip
RUN pip3 install platformio

# Set up ESP-IDF (required for QEMU-ESP32)
ENV IDF_PATH=/opt/esp-idf
ENV IDF_TOOLS_PATH=/opt/esp

# Clone ESP-IDF
RUN git clone --recursive https://github.com/espressif/esp-idf.git -b v5.1.2 ${IDF_PATH}

# Install ESP-IDF tools
WORKDIR ${IDF_PATH}
RUN ./install.sh esp32s3

# Install all tools including QEMU (if available)
RUN ${IDF_PATH}/tools/idf_tools.py install all

# Set up working directory
WORKDIR /workspace

# Copy project files
COPY platformio.ini /workspace/
COPY lib /workspace/lib
COPY src /workspace/src
COPY test /workspace/test
COPY partitions.csv /workspace/

# Create scripts directory
RUN mkdir -p /workspace/scripts

# Set up environment - source ESP-IDF export script
RUN echo "source ${IDF_PATH}/export.sh" >> /root/.bashrc

# Default command
CMD ["/bin/bash"]