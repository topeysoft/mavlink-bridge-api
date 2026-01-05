import { HttpClient, HttpError } from '../../src/core/HttpClient';

// Mock fetch globally
global.fetch = jest.fn();

describe('HttpClient', () => {
    let httpClient: HttpClient;
    const baseUrl = 'http://test-device.local';

    const createMockResponse = (body: any, ok = true, status = 200) => ({
        ok,
        status,
        statusText: ok ? 'OK' : 'Error',
        headers: {
            get: jest.fn((name: string) => {
                if (name === 'content-type') return 'application/json';
                return null;
            })
        },
        json: async () => body,
        text: async () => JSON.stringify(body)
    });

    beforeEach(() => {
        httpClient = new HttpClient(baseUrl, 10000);
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Constructor', () => {
        it('should initialize with base URL and timeout', () => {
            const client = new HttpClient('http://test.com/', 5000);
            expect(client.getBaseUrl()).toBe('http://test.com');
        });

        it('should remove trailing slash from base URL', () => {
            const client = new HttpClient('http://test.com/');
            expect(client.getBaseUrl()).toBe('http://test.com');
        });
    });

    describe('GET requests', () => {
        it('should make successful GET request', async () => {
            const mockData = { status: 'ok', value: 42 };
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => mockData,
                headers: new Headers({ 'content-type': 'application/json' })
            });

            const result = await httpClient.get('/api/test');

            expect(global.fetch).toHaveBeenCalledWith(
                `${baseUrl}/api/test`,
                expect.objectContaining({
                    method: 'GET',
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json'
                    })
                })
            );
            expect(result).toEqual(mockData);
        });

        it('should handle GET request with custom headers', async () => {
            (global.fetch as jest.Mock).mockResolvedValue(createMockResponse({}));

            await httpClient.get('/api/test', {
                headers: { 'X-Custom-Header': 'value' }
            });

            expect(global.fetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'X-Custom-Header': 'value'
                    })
                })
            );
        });

        it.skip('should handle GET request timeout', async () => {
            (global.fetch as jest.Mock).mockImplementation(() =>
                new Promise(() => { }) // Never resolves
            );

            await expect(
                httpClient.get('/api/test', { timeout: 100 })
            ).rejects.toThrow('timeout');
        }, 10000);
    });

    describe('POST requests', () => {
        it('should make successful POST request', async () => {
            const requestData = { command: 'arm' };
            const responseData = { success: true };
            (global.fetch as jest.Mock).mockResolvedValue(createMockResponse(responseData));

            const result = await httpClient.post('/api/command', requestData);

            expect(global.fetch).toHaveBeenCalledWith(
                `${baseUrl}/api/command`,
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify(requestData)
                })
            );
            expect(result).toEqual(responseData);
        });

        it('should make POST request without body', async () => {
            (global.fetch as jest.Mock).mockResolvedValue(createMockResponse({}));

            await httpClient.post('/api/trigger');

            expect(global.fetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    method: 'POST'
                })
            );
        });
    });

    describe('PATCH requests', () => {
        it('should make successful PATCH request', async () => {
            const patchData = [{ op: 'replace', path: '/name', value: 'new-name' }];
            (global.fetch as jest.Mock).mockResolvedValue(createMockResponse({}));

            await httpClient.patch('/api/config', patchData);

            expect(global.fetch).toHaveBeenCalledWith(
                `${baseUrl}/api/config`,
                expect.objectContaining({
                    method: 'PATCH',
                    body: JSON.stringify(patchData)
                })
            );
        });
    });

    describe('PUT requests', () => {
        it('should make successful PUT request', async () => {
            const putData = { name: 'Updated', value: 100 };
            (global.fetch as jest.Mock).mockResolvedValue(createMockResponse(putData));

            const result = await httpClient.put('/api/resource/123', putData);

            expect(global.fetch).toHaveBeenCalledWith(
                `${baseUrl}/api/resource/123`,
                expect.objectContaining({
                    method: 'PUT',
                    body: JSON.stringify(putData)
                })
            );
            expect(result).toEqual(putData);
        });
    });

    describe('DELETE requests', () => {
        it('should make successful DELETE request', async () => {
            (global.fetch as jest.Mock).mockResolvedValue(createMockResponse({}));

            await httpClient.delete('/api/resource/123');

            expect(global.fetch).toHaveBeenCalledWith(
                `${baseUrl}/api/resource/123`,
                expect.objectContaining({
                    method: 'DELETE'
                })
            );
        });
    });

    describe('Error handling', () => {
        it('should handle HTTP error responses', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: false,
                status: 404,
                statusText: 'Not Found',
                json: async () => ({ error: 'Resource not found' })
            });

            await expect(httpClient.get('/api/missing')).rejects.toThrow();
        });

        it('should handle network errors', async () => {
            (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

            await expect(httpClient.get('/api/test')).rejects.toThrow('Network error');
        });

        it('should handle JSON parse errors', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: async () => {
                    throw new Error('Invalid JSON');
                }
            });

            await expect(httpClient.get('/api/test')).rejects.toThrow();
        });
    });

    describe('Request timeout', () => {
        it.skip('should use default timeout', async () => {
            (global.fetch as jest.Mock).mockImplementation(() =>
                new Promise(() => { }) // Never resolves
            );

            const promise = httpClient.get('/api/test');
            await expect(promise).rejects.toThrow('timeout');
        }, 15000);

        it.skip('should use custom timeout from options', async () => {
            (global.fetch as jest.Mock).mockImplementation(() =>
                new Promise(() => { }) // Never resolves
            );

            const promise = httpClient.get('/api/test', { timeout: 5000 });
            await expect(promise).rejects.toThrow('timeout');
        }, 10000);
    });

    describe('getBaseUrl', () => {
        it('should return the base URL', () => {
            expect(httpClient.getBaseUrl()).toBe(baseUrl);
        });
    });

    describe('Edge cases', () => {
        it('should handle empty response body', async () => {
            (global.fetch as jest.Mock).mockResolvedValue(createMockResponse(null));

            const result = await httpClient.get('/api/test');
            expect(result).toBeNull();
        });

        it('should handle concurrent requests', async () => {
            (global.fetch as jest.Mock).mockResolvedValue(createMockResponse({ success: true }));

            const promises = [
                httpClient.get('/api/test1'),
                httpClient.get('/api/test2'),
                httpClient.get('/api/test3')
            ];

            const results = await Promise.all(promises);

            expect(results).toHaveLength(3);
            expect(global.fetch).toHaveBeenCalledTimes(3);
        });
    });
});
