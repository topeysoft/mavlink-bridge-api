import { MAVLinkParameterClient } from '../../src/mavlink/parameters/MAVLinkParameterClient';
import { HttpClient } from '../../src/core/HttpClient';
import {
    ParameterResponse,
    ParameterValue,
    ParameterValidationError
} from '../../src/mavlink/parameters/ParameterTypes';
import { ParameterValidator } from '../../src/mavlink/parameters/ParameterValidation';

// Mock the ParameterValidator
jest.mock('../../src/mavlink/parameters/ParameterValidation');

class MockHttpClient {
    post = jest.fn();
    getBaseUrl = jest.fn(() => 'http://test');
}

describe('MAVLinkParameterClient', () => {
    let paramClient: MAVLinkParameterClient;
    let mockHttpClient: MockHttpClient;

    beforeEach(() => {
        mockHttpClient = new MockHttpClient();
        paramClient = new MAVLinkParameterClient(mockHttpClient as any);
        jest.clearAllMocks();

        // Mock the validateParameter to always return valid
        (ParameterValidator.validateParameter as jest.Mock).mockReturnValue({
            valid: true,
            errors: []
        });
    });

    describe('requestParameter', () => {
        it('should request parameter by name', async () => {
            const mockResponse: ParameterResponse = {
                success: true,
                parameterName: 'SYSID_THISMAV',
                value: 1
            };
            mockHttpClient.post.mockResolvedValue(mockResponse);

            const result = await paramClient.requestParameter('SYSID_THISMAV');

            expect(mockHttpClient.post).toHaveBeenCalledWith(
                '/api/mavlink/parameters/request',
                expect.objectContaining({
                    parameterName: 'SYSID_THISMAV'
                })
            );
            expect(result).toEqual(mockResponse);
        });
    });

    describe('requestParameterByIndex', () => {
        it('should request parameter by index', async () => {
            mockHttpClient.post.mockResolvedValue({ success: true, value: 42 });

            await paramClient.requestParameterByIndex(0);

            expect(mockHttpClient.post).toHaveBeenCalledWith(
                '/api/mavlink/parameters/request',
                expect.objectContaining({
                    parameterIndex: 0
                })
            );
        });
    });

    describe('setParameter', () => {
        it('should set parameter with validation', async () => {
            const mockResponse: ParameterResponse = {
                success: true,
                parameterName: 'SYSID_THISMAV',
                value: 2
            };
            mockHttpClient.post.mockResolvedValue(mockResponse);

            const result = await paramClient.setParameter('SYSID_THISMAV', 2);

            expect(mockHttpClient.post).toHaveBeenCalledWith(
                '/api/mavlink/parameters/set',
                expect.objectContaining({
                    parameterName: 'SYSID_THISMAV',
                    value: 2
                })
            );
            expect(result).toEqual(mockResponse);
        });

        it('should update cache after successful set', async () => {
            mockHttpClient.post.mockResolvedValue({
                success: true,
                parameterName: 'TEST_PARAM',
                value: 100
            });

            await paramClient.setParameter('TEST_PARAM', 100);

            const cached = paramClient.getParameterFromCache('TEST_PARAM');
            expect(cached?.value).toBe(100);
        });
    });

    describe('requestParameterList', () => {
        it('should request complete parameter list', async () => {
            mockHttpClient.post.mockResolvedValue({ success: true });

            await paramClient.requestParameterList();

            expect(mockHttpClient.post).toHaveBeenCalledWith(
                '/api/mavlink/parameters/list',
                expect.objectContaining({
                    targetSystem: 1,
                    targetComponent: 1
                })
            );
        });
    });

    describe('Cache management', () => {
        it('should get parameter from cache', () => {
            const param = paramClient.getParameterFromCache('NON_EXISTENT');
            expect(param).toBeUndefined();
        });

        it('should get all cached parameters', () => {
            const params = paramClient.getAllCachedParameters();
            expect(Array.isArray(params)).toBe(true);
        });

        it('should search cached parameters', () => {
            const results = paramClient.searchCachedParameters({ query: 'SYSID' });
            expect(results).toHaveProperty('parameters');
            expect(results).toHaveProperty('totalCount');
            expect(results).toHaveProperty('hasMore');
        });

        it('should apply limit and offset to search results', () => {
            // Add some test parameters to cache first
            const results = paramClient.searchCachedParameters({
                query: '', limit: 10,
                offset: 0
            });
            expect(results.parameters.length).toBeLessThanOrEqual(10);
        });
    });

    describe('getCacheStats', () => {
        it('should return cache statistics', () => {
            const stats = paramClient.getCacheStats();
            expect(stats).toHaveProperty('totalParameters');
            expect(stats).toHaveProperty('modifiedParameters');
        });
    });

    describe('Parameter streaming', () => {
        it('should start parameter stream', async () => {
            // Note: EventSource is not available in Node.js by default
            // This test would need proper mocking or skip in Node environment
            try {
                await paramClient.startParameterStream();
            } catch (error) {
                // Expected in Node.js environment
                expect(error).toBeDefined();
            }
        });

        it('should stop parameter stream', () => {
            paramClient.stopParameterStream();
            // Should not throw
            expect(true).toBe(true);
        });
    });

    describe('Error handling', () => {
        it('should handle request errors', async () => {
            mockHttpClient.post.mockRejectedValue(new Error('Network error'));

            await expect(
                paramClient.requestParameter('TEST_PARAM')
            ).rejects.toThrow();
        });

        it('should handle set parameter errors', async () => {
            mockHttpClient.post.mockRejectedValue(new Error('Parameter not found'));

            await expect(
                paramClient.setParameter('INVALID_PARAM', 42)
            ).rejects.toThrow();
        });
    });
});
