const { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const ObjectStoreStorage = require('../index.js');

// Mock the S3 client for testing
jest.mock('@aws-sdk/client-s3');

describe('ObjectStoreStorage', () => {
  let objectStoreStorage;
  let mockS3Client;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create a mock S3 client
    mockS3Client = {
      send: jest.fn()
    };

    // Mock the S3Client constructor to return our mock
    S3Client.mockImplementation(() => {
      return mockS3Client;
    });

    // Create ObjectStoreStorage instance with test configuration
    objectStoreStorage = new ObjectStoreStorage({
      endpoint: 'localhost:9000',
      accessKey: 'test-access-key',
      secretKey: 'test-secret-key',
      bucket: 'test-bucket',
      region: 'us-east-1',
      useSSL: false
    });
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      expect(objectStoreStorage.endpoint).toBe('localhost:9000');
      expect(objectStoreStorage.accessKey).toBe('test-access-key');
      expect(objectStoreStorage.secretKey).toBe('test-secret-key');
      expect(objectStoreStorage.bucket).toBe('test-bucket');
      expect(objectStoreStorage.region).toBe('us-east-1');
      expect(objectStoreStorage.useSSL).toBe(false);
    });

    it('should set up S3 client with correct configuration', () => {
      expect(S3Client).toHaveBeenCalledWith({
        endpoint: 'localhost:9000',
        region: 'us-east-1',
        credentials: {
          accessKeyId: 'test-access-key',
          secretAccessKey: 'test-secret-key'
        },
        forcePathStyle: true,
        tls: false
      });
    });
  });

  describe('save', () => {
    it('should save a file to Object Store and return the URL', async () => {
      const mockFile = {
        contents: Buffer.from('test content'),
        type: 'image/jpeg',
        path: '/local/path/to/file.jpg'
      };

      const mockUniqueFileName = 'test-file-123.jpg';
      const mockUrl = '/test-file-123.jpg';

      // Mock the getUniqueSecureFilePath method to return a test filename
      objectStoreStorage.getUniqueSecureFilePath = jest.fn().mockResolvedValue(mockUniqueFileName);

      // Mock the S3 client send to resolve with successful response
      mockS3Client.send.mockResolvedValue({});

      const result = await objectStoreStorage.save(mockFile, '/images');

      expect(objectStoreStorage.getUniqueSecureFilePath).toHaveBeenCalledWith(mockFile, '/images');
      expect(mockS3Client.send).toHaveBeenCalledWith(expect.any(PutObjectCommand));
      expect(result).toBe(mockUrl);
    });

    it('should handle save errors properly', async () => {
      const mockFile = {
        contents: Buffer.from('test content'),
        type: 'image/jpeg',
        path: '/local/path/to/file.jpg'
      };
      const mockUniqueFileName = 'test-file-123.jpg';

      // Mock the getUniqueSecureFilePath method to return a test filename
      objectStoreStorage.getUniqueSecureFilePath = jest.fn().mockResolvedValue(mockUniqueFileName);

      // Mock an error from the S3 client
      mockS3Client.send.mockRejectedValue(new Error('Save failed'));

      await expect(objectStoreStorage.save(mockFile, '/images')).rejects.toThrow('Failed to save file to Object Store');
    });
  });

  describe('saveRaw', () => {
    it('should save a buffer to Object Store and return the URL', async () => {
      const mockBuffer = Buffer.from('test buffer content');
      const mockUrl = '/content/media/test-file-123.jpg';

      mockS3Client.send.mockResolvedValue({});

      const result = await objectStoreStorage.saveRaw(mockBuffer, 'test-file-123.jpg');

      expect(mockS3Client.send).toHaveBeenCalledWith(expect.any(PutObjectCommand));
      expect(result).toBe(mockUrl);
    });

    it('should handle saveRaw errors properly', async () => {
      const mockBuffer = Buffer.from('test buffer content');

      mockS3Client.send.mockRejectedValue(new Error('Save raw failed'));

      await expect(objectStoreStorage.saveRaw(mockBuffer, 'test-file-123.jpg')).rejects.toThrow('Failed to save buffer to Object Store');
    });
  });

  describe('exists', () => {
    it('should check if a file exists in Object Store and return true', async () => {
      mockS3Client.send.mockResolvedValue({});

      const result = await objectStoreStorage.exists('test-file.jpg', '/images');

      expect(mockS3Client.send).toHaveBeenCalledWith(expect.any(HeadObjectCommand));
      expect(result).toBe(true);
    });

    it('should check if a file exists in Object Store and return false', async () => {
      const mockError = new Error('Not Found');
      mockError.name = 'NotFound';
      mockS3Client.send.mockRejectedValue(mockError);

      const result = await objectStoreStorage.exists('non-existant-file.jpg', '/images');

      expect(mockS3Client.send).toHaveBeenCalledWith(expect.any(HeadObjectCommand));
      expect(result).toBe(false);
    });

    it('should rethrow errors that are not NotFound', async () => {
      const mockError = new Error('Internal error');
      mockS3Client.send.mockRejectedValue(mockError);

      await expect(objectStoreStorage.exists('test-file.jpg', '/images')).rejects.toThrow('Internal error');
    });
  });

  describe('delete', () => {
    it('should delete a file from Object Store successfully', async () => {
      mockS3Client.send.mockResolvedValue({});

      await expect(objectStoreStorage.delete('test-file.jpg', '/images')).resolves.toBeUndefined();

      expect(mockS3Client.send).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));
    });

    it('should handle delete errors properly', async () => {
      const mockError = new Error('Delete failed');
      mockS3Client.send.mockRejectedValue(mockError);

      await expect(objectStoreStorage.delete('test-file.jpg', '/images')).rejects.toThrow('Failed to delete file from Object Store');
    });
  });

  describe('read', () => {
    it('should read file content from Object Store and return a buffer', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: () => ({
          next: () => Promise.resolve({ done: true, value: Buffer.from('file content') })
        })
      };

      const mockResponse = {
        Body: mockStream
      };

      mockS3Client.send.mockResolvedValue(mockResponse);

      const result = await objectStoreStorage.read({ path: 'test-file.jpg' });

      expect(mockS3Client.send).toHaveBeenCalledWith(expect.any(GetObjectCommand));
      expect(result).toBeInstanceOf(Buffer);
    });

    it('should handle read errors properly', async () => {
      const mockError = new Error('File not found');
      mockError.name = 'NoSuchKey';
      mockS3Client.send.mockRejectedValue(mockError);

      await expect(objectStoreStorage.read({ path: 'non-existant-file.jpg' })).rejects.toThrow('File not found');
    });
  });

  describe('serve', () => {
    it('should return an Express middleware function', () => {
      const middleware = objectStoreStorage.serve();

      expect(typeof middleware).toBe('function');
      expect(middleware.length).toBe(3); // req, res, next
    });

    it('should handle file serving from Object Store with proper streaming', async () => {
      // Create a mock readable stream for testing
      const mockStream = {
        pipe: jest.fn()
      };

      const mockResponse = {
        Body: mockStream,
        ContentType: 'image/jpeg',
        ETag: '"test-etag"',
        LastModified: new Date('2025-10-30T00:00:00Z')
      };

      mockS3Client.send.mockResolvedValue(mockResponse);

      const middleware = objectStoreStorage.serve();

      // Create mock request and response objects
      const req = { path: '/test-file.jpg' };
      const res = {
        set: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      };
      const next = jest.fn();

      // Call the middleware
      await middleware(req, res, next);

      // Verify that the S3 client was called with the correct command
      expect(mockS3Client.send).toHaveBeenCalledWith(expect.any(GetObjectCommand));

      // Verify that response headers were set correctly
      expect(res.set).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
      expect(res.set).toHaveBeenCalledWith('Cache-Control', 'public, max-age=31536000');
      expect(res.set).toHaveBeenCalledWith('ETag', '"test-etag"');
      expect(res.set).toHaveBeenCalledWith('Last-Modified', new Date('2025-10-30T00:00:00Z').toUTCString());

      // Verify that the stream was piped to the response
      expect(mockStream.pipe).toHaveBeenCalledWith(res);
    });

    it('should handle file not found correctly', async () => {
      const mockError = new Error('Not Found');
      mockError.name = 'NotFound';
      mockS3Client.send.mockRejectedValue(mockError);

      const middleware = objectStoreStorage.serve();

      // Create mock request and response objects
      const req = { path: '/nonexistent.jpg' };
      const res = {
        set: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      };
      const next = jest.fn();

      // Call the middleware
      await middleware(req, res, next);

      // Verify that 404 was sent
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith('File not found');
    });

    it('should handle file serving from Object Store with proper streaming', async () => {
      // Create a mock readable stream for testing
      const mockStream = {
        pipe: jest.fn()
      };

      const mockResponse = {
        Body: mockStream,
        ContentType: 'image/jpeg',
        ETag: '"test-etag"',
        LastModified: new Date('2025-10-30T00:00:00Z')
      };

      mockS3Client.send.mockResolvedValue(mockResponse);

      const middleware = objectStoreStorage.serve();

      // Create mock request and response objects
      const req = { path: '/test-file.jpg' };
      const res = {
        set: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      };
      const next = jest.fn();

      // Call the middleware
      await middleware(req, res, next);

      // Verify that the S3 client was called with the correct command
      expect(mockS3Client.send).toHaveBeenCalledWith(expect.any(GetObjectCommand));

      // Verify that response headers were set correctly
      expect(res.set).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
      expect(res.set).toHaveBeenCalledWith('Cache-Control', 'public, max-age=31536000');
      expect(res.set).toHaveBeenCalledWith('ETag', '"test-etag"');
      expect(res.set).toHaveBeenCalledWith('Last-Modified', new Date('2025-10-30T00:00:00Z').toUTCString());

      // Verify that the stream was piped to the response
      expect(mockStream.pipe).toHaveBeenCalledWith(res);
    });

    it('should handle file not found correctly', async () => {
      const mockResponse = {
        Body: null
      };

      mockS3Client.send.mockResolvedValue(mockResponse);

      const middleware = objectStoreStorage.serve();

      // Create mock request and response objects
      const req = { path: '/nonexistent.jpg' };
      const res = {
        set: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      };
      const next = jest.fn();

      // Call the middleware
      await middleware(req, res, next);

      // Verify that the S3 client was called with the correct command
      expect(mockS3Client.send).toHaveBeenCalledWith(expect.any(GetObjectCommand));

      // Verify that 404 was sent
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith('File not found');
    });

    it('should handle internal errors correctly', async () => {
      const mockError = new Error('Internal server error');
      mockS3Client.send.mockRejectedValue(mockError);

      const middleware = objectStoreStorage.serve();

      // Create mock request and response objects
      const req = { path: '/test-file.jpg' };
      const res = {
        set: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      };
      const next = jest.fn();

      // Call the middleware
      await middleware(req, res, next);

      // Verify that next was called with the error
      expect(next).toHaveBeenCalledWith(mockError);
    });

    it('should handle 404 errors properly', async () => {
      const mockError = new Error('Not Found');
      mockError.name = 'NotFound';
      mockS3Client.send.mockRejectedValue(mockError);

      const middleware = objectStoreStorage.serve();

      // Create mock request and response objects
      const req = { path: '/nonexistent.jpg' };
      const res = {
        set: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      };
      const next = jest.fn();

      // Call the middleware
      await middleware(req, res, next);

      // Verify that 404 was sent
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith('File not found');
    });
  });
});
