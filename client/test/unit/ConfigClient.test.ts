import { ConfigClient } from '../../src/config/ConfigClient';
import { HttpClient, HttpError } from '../../src/core/HttpClient';
import {
  Configuration,
  ConfigPatchOperation,
  ConfigValidationError,
  VersionConflictError,
  StorageError
} from '../../src/config/ConfigTypes';

// Create a mock HttpClient class
class MockHttpClient {
  get = jest.fn();
  post = jest.fn();
  patch = jest.fn();
  getBaseUrl = jest.fn(() => 'http://test');
  setTimeout = jest.fn();
}

const mockHttpClient = new MockHttpClient() as any;

describe('ConfigClient', () => {
  let configClient: ConfigClient;
  let mockConfig: Configuration;

  beforeEach(() => {
    configClient = new ConfigClient(mockHttpClient);
    mockConfig = {
      version: 1,
      device: {
        name: 'ESP32-MAVLinkBridge',
        mode: 'usb_otg'
      },
      connection: {
        type: 'wifi',
        wifi: {
          ssid: 'TestNetwork',
          autoConnect: true,
          apModeEnabled: false,
          apSSID: 'ESP32-AP',
          apPassword: 'password123'
        }
      },
      rtcm: {
        enabled: false,
        source: {
          type: 'ntrip',
          host: '',
          port: 2101
        }
      }
    };

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('getConfiguration', () => {
    it('should retrieve configuration successfully', async () => {
      mockHttpClient.get.mockResolvedValue(mockConfig);

      const result = await configClient.getConfiguration();

      expect(mockHttpClient.get).toHaveBeenCalledWith('/api/config');
      expect(result).toEqual(mockConfig);
    });

    it('should handle network errors', async () => {
      const error = new Error('Network error');
      mockHttpClient.get.mockRejectedValue(error);

      await expect(configClient.getConfiguration()).rejects.toThrow('Network error');
    });
  });

  describe('setConfiguration', () => {
    it('should set configuration successfully', async () => {
      mockHttpClient.post.mockResolvedValue(undefined);

      await configClient.setConfiguration(mockConfig);

      expect(mockHttpClient.post).toHaveBeenCalledWith('/api/config', mockConfig, {
        headers: {},
        timeout: undefined
      });
    });

    it('should set configuration with version header', async () => {
      mockHttpClient.post.mockResolvedValue(undefined);

      await configClient.setConfiguration(mockConfig, { expectedVersion: 5 });

      expect(mockHttpClient.post).toHaveBeenCalledWith('/api/config', mockConfig, {
        headers: { 'X-Config-Version': '5' },
        timeout: undefined
      });
    });

    it('should validate configuration by default', async () => {
      const invalidConfig = { ...mockConfig, device: { ...mockConfig.device, name: '' } };

      await expect(configClient.setConfiguration(invalidConfig)).rejects.toThrow(ConfigValidationError);
      expect(mockHttpClient.post).not.toHaveBeenCalled();
    });

    it('should skip validation when disabled', async () => {
      mockHttpClient.post.mockResolvedValue(undefined);
      const invalidConfig = { ...mockConfig, device: { ...mockConfig.device, name: '' } };

      await configClient.setConfiguration(invalidConfig, { validate: false });

      expect(mockHttpClient.post).toHaveBeenCalled();
    });

    it('should handle version conflict error', async () => {
      const error = new HttpError(409, 'Version conflict');
      mockHttpClient.post.mockRejectedValue(error);

      await expect(configClient.setConfiguration(mockConfig)).rejects.toThrow(VersionConflictError);
    });

    it('should handle storage error', async () => {
      const error = new HttpError(507, 'Insufficient storage space');
      mockHttpClient.post.mockRejectedValue(error);

      await expect(configClient.setConfiguration(mockConfig)).rejects.toThrow(StorageError);
    });

    it('should handle validation error', async () => {
      const error = new HttpError(400, 'Invalid device name');
      mockHttpClient.post.mockRejectedValue(error);

      await expect(configClient.setConfiguration(mockConfig)).rejects.toThrow(ConfigValidationError);
    });
  });

  describe('patchConfiguration', () => {
    const patchOps: ConfigPatchOperation[] = [
      { op: 'replace', path: '/device/name', value: 'NewName' }
    ];

    it('should apply patches successfully', async () => {
      mockHttpClient.patch.mockResolvedValue(undefined);

      await configClient.patchConfiguration(patchOps);

      expect(mockHttpClient.patch).toHaveBeenCalledWith('/api/config',
        expect.arrayContaining([
          expect.objectContaining({ op: 'replace', path: '/device/name', value: 'NewName' })
        ]),
        { headers: {}, timeout: undefined }
      );
    });

    it('should handle empty patch operations', async () => {
      await configClient.patchConfiguration([]);

      expect(mockHttpClient.patch).not.toHaveBeenCalled();
    });

    it('should reject too many operations', async () => {
      const manyOps = Array(15).fill({ op: 'replace', path: '/device/name', value: 'test' });

      await expect(configClient.patchConfiguration(manyOps)).rejects.toThrow('Too many patch operations');
      expect(mockHttpClient.patch).not.toHaveBeenCalled();
    });

    it('should include version header when specified', async () => {
      mockHttpClient.patch.mockResolvedValue(undefined);

      await configClient.patchConfiguration(patchOps, { expectedVersion: 3 });

      expect(mockHttpClient.patch).toHaveBeenCalledWith('/api/config',
        expect.any(Array),
        { headers: { 'X-Config-Version': '3' }, timeout: undefined }
      );
    });
  });

  describe('updateConfigurationWithRetry', () => {
    it('should succeed on first attempt', async () => {
      mockHttpClient.get.mockResolvedValue(mockConfig);
      mockHttpClient.post.mockResolvedValue(undefined);

      const updateFn = (config: Configuration) => ({
        ...config,
        device: { ...config.device, name: 'UpdatedName' }
      });

      await configClient.updateConfigurationWithRetry(updateFn);

      expect(mockHttpClient.get).toHaveBeenCalledTimes(1);
      expect(mockHttpClient.post).toHaveBeenCalledTimes(1);
    });

    it('should retry on version conflict', async () => {
      let callCount = 0;
      mockHttpClient.get.mockImplementation(() => {
        callCount++;
        return Promise.resolve({ ...mockConfig, version: callCount });
      });

      mockHttpClient.post
        .mockRejectedValueOnce(new VersionConflictError(1, 2))
        .mockResolvedValueOnce(undefined);

      const updateFn = (config: Configuration) => ({
        ...config,
        device: { ...config.device, name: 'UpdatedName' }
      });

      await configClient.updateConfigurationWithRetry(updateFn);

      expect(mockHttpClient.get).toHaveBeenCalledTimes(2);
      expect(mockHttpClient.post).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries', async () => {
      mockHttpClient.get.mockResolvedValue(mockConfig);
      mockHttpClient.post.mockRejectedValue(new VersionConflictError(1, 2));

      const updateFn = (config: Configuration) => ({
        ...config,
        device: { ...config.device, name: 'UpdatedName' }
      });

      await expect(configClient.updateConfigurationWithRetry(updateFn, 2)).rejects.toThrow(VersionConflictError);

      expect(mockHttpClient.get).toHaveBeenCalledTimes(2);
      expect(mockHttpClient.post).toHaveBeenCalledTimes(2);
    });
  });

  describe('batchUpdate', () => {
    it('should handle single batch', async () => {
      mockHttpClient.patch.mockResolvedValue(undefined);

      const operations: ConfigPatchOperation[] = [
        { op: 'replace', path: '/device/name', value: 'BatchName' },
        { op: 'replace', path: '/device/mode', value: 'uart' }
      ];

      await configClient.batchUpdate(operations);

      expect(mockHttpClient.patch).toHaveBeenCalledTimes(1);
      expect(mockHttpClient.patch).toHaveBeenCalledWith('/api/config', operations, { headers: {}, timeout: undefined });
    });

    it('should split large batches into chunks', async () => {
      mockHttpClient.patch.mockResolvedValue(undefined);
      mockHttpClient.get.mockResolvedValue({ ...mockConfig, version: 2 });

      const operations: ConfigPatchOperation[] = Array(15).fill(null).map((_, i) => ({
        op: 'replace',
        path: `/device/name`,
        value: `Name${i}`
      }));

      await configClient.batchUpdate(operations);

      expect(mockHttpClient.patch).toHaveBeenCalledTimes(2);
      expect(mockHttpClient.get).toHaveBeenCalledTimes(1); // Called between chunks
    });
  });

  describe('createConfigurationPatch', () => {
    it('should create patch for device name change', () => {
      const oldConfig = mockConfig;
      const newConfig = { ...mockConfig, device: { ...mockConfig.device, name: 'NewName' } };

      const patches = configClient.createConfigurationPatch(oldConfig, newConfig);

      expect(patches).toHaveLength(1);
      expect(patches[0]).toEqual({
        op: 'replace',
        path: '/device/name',
        value: 'NewName'
      });
    });

    it('should create multiple patches for multiple changes', () => {
      const oldConfig = mockConfig;
      const newConfig = {
        ...mockConfig,
        device: { ...mockConfig.device, name: 'NewName', mode: 'uart' as const },
        rtcm: { ...mockConfig.rtcm, enabled: true }
      };

      const patches = configClient.createConfigurationPatch(oldConfig, newConfig);

      expect(patches).toHaveLength(3);
      expect(patches).toContainEqual({ op: 'replace', path: '/device/name', value: 'NewName' });
      expect(patches).toContainEqual({ op: 'replace', path: '/device/mode', value: 'uart' });
      expect(patches).toContainEqual({ op: 'replace', path: '/rtcm/enabled', value: true });
    });

    it('should return empty array for identical configurations', () => {
      const patches = configClient.createConfigurationPatch(mockConfig, mockConfig);

      expect(patches).toHaveLength(0);
    });
  });

  describe('convenience methods', () => {
    beforeEach(() => {
      mockHttpClient.patch.mockResolvedValue(undefined);
    });

    it('should update device name', async () => {
      await configClient.updateDeviceName('NewDevice');

      expect(mockHttpClient.patch).toHaveBeenCalledWith('/api/config',
        [{ op: 'replace', path: '/device/name', value: 'NewDevice' }],
        { headers: {}, timeout: undefined }
      );
    });

    it('should reject invalid device names', async () => {
      await expect(configClient.updateDeviceName('')).rejects.toThrow('Device name must be between 1 and 32 characters');
      await expect(configClient.updateDeviceName('A'.repeat(33))).rejects.toThrow('Device name must be between 1 and 32 characters');
    });

    it('should update device mode', async () => {
      await configClient.updateDeviceMode('uart');

      expect(mockHttpClient.patch).toHaveBeenCalledWith('/api/config',
        [{ op: 'replace', path: '/device/mode', value: 'uart' }],
        { headers: {}, timeout: undefined }
      );
    });

    it('should update WiFi SSID', async () => {
      await configClient.updateWiFiSSID('NewNetwork');

      expect(mockHttpClient.patch).toHaveBeenCalledWith('/api/config',
        [{ op: 'replace', path: '/connection/wifi/ssid', value: 'NewNetwork' }],
        { headers: {}, timeout: undefined }
      );
    });

    it('should reject SSID that is too long', async () => {
      await expect(configClient.updateWiFiSSID('A'.repeat(33))).rejects.toThrow('WiFi SSID must be 32 characters or less');
    });

    it('should update RTCM source with all options', async () => {
      await configClient.updateRTCMSource('ntrip', 'rtcm.example.com', 2101, {
        mountpoint: 'TEST',
        username: 'user',
        password: 'pass'
      });

      expect(mockHttpClient.patch).toHaveBeenCalledWith('/api/config',
        expect.arrayContaining([
          { op: 'replace', path: '/rtcm/source/type', value: 'ntrip' },
          { op: 'replace', path: '/rtcm/source/host', value: 'rtcm.example.com' },
          { op: 'replace', path: '/rtcm/source/port', value: 2101 },
          { op: 'replace', path: '/rtcm/source/mountpoint', value: 'TEST' },
          { op: 'replace', path: '/rtcm/source/username', value: 'user' },
          { op: 'replace', path: '/rtcm/source/password', value: 'pass' }
        ]),
        { headers: {}, timeout: undefined }
      );
    });
  });

  describe('validation', () => {
    it('should validate configuration correctly', () => {
      const validConfig = mockConfig;
      const errors = configClient.validateConfiguration(validConfig);

      expect(errors).toHaveLength(0);
    });

    it('should return validation errors for invalid config', () => {
      const invalidConfig = { ...mockConfig, device: { ...mockConfig.device, name: '' } };
      const errors = configClient.validateConfiguration(invalidConfig);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors).toContain('Device name is required');
    });
  });
});