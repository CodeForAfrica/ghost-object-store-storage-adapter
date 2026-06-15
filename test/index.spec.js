const { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const ObjectStoreStorage = require('../index.js');

jest.mock('@aws-sdk/client-s3');

describe('ObjectStoreStorage', () => {
  let objectStoreStorage;
  let mockS3Client;

  beforeEach(() => {
    jest.clearAllMocks();

    mockS3Client = {
      send: jest.fn()
    };

    S3Client.mockImplementation(() => mockS3Client);

    objectStoreStorage = new ObjectStoreStorage({
      endpoint: 'localhost:9000',
      accessKey: 'test-access-key',
      secretKey: 'test-secret-key',
      bucket: 'test-bucket',
      region: 'us-east-1',
      useSSL: false,
      storagePath: 'content/media/',
      staticFileURLPrefix: 'content/media/'
    });
  });

  describe('constructor', () => {
    it('should initialize with provided configuration', () => {
      expect(objectStoreStorage.endpoint).toBe('localhost:9000');
      expect(objectStoreStorage.accessKey).toBe('test-access-key');
      expect(objectStoreStorage.secretKey).toBe('test-secret-key');
      expect(objectStoreStorage.bucket).toBe('test-bucket');
      expect(objectStoreStorage.region).toBe('us-east-1');
      expect(objectStoreStorage.useSSL).toBe(false);
      expect(objectStoreStorage.storagePath).toBe('content/media/');
      expect(objectStoreStorage.staticFileURLPrefix).toBe('content/media/');
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
    let fs;
    const mockFile = {
      name: '0-umnaaktb3eos233i.png',
      path: '/tmp/3bab289aad1a167c811b5767350facdf',
      type: 'image/png'
    };

    beforeEach(() => {
      fs = require('fs');
      fs.promises.readFile = jest.fn();
    });

    it('should save a file and return the object key URL', async () => {
      const mockFileContent = Buffer.from('test file content');

      fs.promises.readFile.mockResolvedValue(mockFileContent);
      objectStoreStorage.getUniqueFileName = jest.fn().mockResolvedValue('images/0-umnaaktb3eos233i.png');
      mockS3Client.send.mockResolvedValue({});

      const result = await objectStoreStorage.save(mockFile, 'images');

      expect(fs.promises.readFile).toHaveBeenCalledWith(mockFile.path);
      expect(objectStoreStorage.getUniqueFileName).toHaveBeenCalledWith(mockFile, 'images');
      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'images/0-umnaaktb3eos233i.png',
        Body: mockFileContent,
        ContentType: 'image/png'
      });
      expect(result).toBe('/images/0-umnaaktb3eos233i.png');
    });

    it('should fall back to getTargetDir when targetDir is not provided', async () => {
      fs.promises.readFile.mockResolvedValue(Buffer.from('x'));
      const getTargetDirSpy = jest.spyOn(objectStoreStorage, 'getTargetDir').mockReturnValue('content/media/2026/06');
      objectStoreStorage.getUniqueFileName = jest.fn().mockResolvedValue('content/media/2026/06/file.png');
      mockS3Client.send.mockResolvedValue({});

      await objectStoreStorage.save(mockFile);

      expect(getTargetDirSpy).toHaveBeenCalledWith('content/media/');
      expect(objectStoreStorage.getUniqueFileName).toHaveBeenCalledWith(mockFile, 'content/media/2026/06');
    });

    it('should normalize backslashes in the object key', async () => {
      fs.promises.readFile.mockResolvedValue(Buffer.from('x'));
      objectStoreStorage.getUniqueFileName = jest.fn().mockResolvedValue('images\\sub\\file.png');
      mockS3Client.send.mockResolvedValue({});

      const result = await objectStoreStorage.save(mockFile, 'images');

      expect(PutObjectCommand).toHaveBeenCalledWith(expect.objectContaining({
        Key: 'images/sub/file.png'
      }));
      expect(result).toBe('/images/sub/file.png');
    });

    it('should wrap S3 errors with a descriptive message', async () => {
      fs.promises.readFile.mockResolvedValue(Buffer.from('x'));
      objectStoreStorage.getUniqueFileName = jest.fn().mockResolvedValue(mockFile.name);
      mockS3Client.send.mockRejectedValue(new Error('Save failed'));

      await expect(objectStoreStorage.save(mockFile, 'images'))
        .rejects.toThrow('Failed to save file to Object Store: Save failed');
    });
  });

  describe('saveRaw', () => {
    it('should save a buffer under the staticFileURLPrefix and return the URL', async () => {
      const mockBuffer = Buffer.from('test buffer content');
      mockS3Client.send.mockResolvedValue({});

      const result = await objectStoreStorage.saveRaw(mockBuffer, 'test-file-123.jpg');

      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'content/media/test-file-123.jpg',
        Body: mockBuffer
      });
      expect(result).toBe('/content/media/test-file-123.jpg');
    });

    it('should normalize backslashes in the target path', async () => {
      const mockBuffer = Buffer.from('x');
      mockS3Client.send.mockResolvedValue({});

      const result = await objectStoreStorage.saveRaw(mockBuffer, 'sub\\dir\\file.jpg');

      expect(PutObjectCommand).toHaveBeenCalledWith(expect.objectContaining({
        Key: 'content/media/sub/dir/file.jpg'
      }));
      expect(result).toBe('/content/media/sub/dir/file.jpg');
    });

    it('should wrap S3 errors with a descriptive message', async () => {
      mockS3Client.send.mockRejectedValue(new Error('Save raw failed'));

      await expect(objectStoreStorage.saveRaw(Buffer.from('x'), 'test-file-123.jpg'))
        .rejects.toThrow('Failed to save buffer to Object Store: Save raw failed');
    });
  });

  describe('exists', () => {
    it('should return true when the object exists', async () => {
      mockS3Client.send.mockResolvedValue({});

      const result = await objectStoreStorage.exists('test-file.jpg', 'images');

      expect(HeadObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'images/test-file.jpg'
      });
      expect(result).toBe(true);
    });

    it('should return false when the object does not exist', async () => {
      const mockError = new Error('Not Found');
      mockError.name = 'NotFound';
      mockS3Client.send.mockRejectedValue(mockError);

      const result = await objectStoreStorage.exists('non-existant-file.jpg', 'images');

      expect(result).toBe(false);
    });

    it('should build the key without a separator when targetDir is omitted', async () => {
      mockS3Client.send.mockResolvedValue({});

      await objectStoreStorage.exists('test-file.jpg');

      expect(HeadObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'test-file.jpg'
      });
    });

    it('should rethrow errors that are not NotFound', async () => {
      mockS3Client.send.mockRejectedValue(new Error('Internal error'));

      await expect(objectStoreStorage.exists('test-file.jpg', 'images'))
        .rejects.toThrow('Internal error');
    });
  });

  describe('delete', () => {
    it('should delete the file at the constructed key', async () => {
      mockS3Client.send.mockResolvedValue({});

      await expect(objectStoreStorage.delete('test-file.jpg', 'images')).resolves.toBeUndefined();

      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'images/test-file.jpg'
      });
    });

    it('should build the key without a separator when targetDir is omitted', async () => {
      mockS3Client.send.mockResolvedValue({});

      await objectStoreStorage.delete('test-file.jpg');

      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'test-file.jpg'
      });
    });

    it('should wrap S3 errors with a descriptive message', async () => {
      mockS3Client.send.mockRejectedValue(new Error('Delete failed'));

      await expect(objectStoreStorage.delete('test-file.jpg', 'images'))
        .rejects.toThrow('Failed to delete file from Object Store: Delete failed');
    });
  });

  describe('read', () => {
    const streamOf = (chunks) => ({
      async *[Symbol.asyncIterator]() {
        for (const chunk of chunks) {
          yield chunk;
        }
      }
    });

    it('should read the object and concatenate streamed chunks', async () => {
      mockS3Client.send.mockResolvedValue({
        Body: streamOf([Buffer.from('hello '), Buffer.from('world')])
      });

      const result = await objectStoreStorage.read({ path: 'images/test-file.jpg' });

      expect(GetObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'images/test-file.jpg'
      });
      expect(result).toBeInstanceOf(Buffer);
      expect(result.toString()).toBe('hello world');
    });

    it('should translate NoSuchKey into a "File not found" error', async () => {
      const mockError = new Error('NoSuchKey');
      mockError.name = 'NoSuchKey';
      mockS3Client.send.mockRejectedValue(mockError);

      await expect(objectStoreStorage.read({ path: 'non-existant-file.jpg' }))
        .rejects.toThrow('File not found: non-existant-file.jpg');
    });

    it('should wrap unexpected errors with a descriptive message', async () => {
      mockS3Client.send.mockRejectedValue(new Error('Connection reset'));

      await expect(objectStoreStorage.read({ path: 'images/file.jpg' }))
        .rejects.toThrow('Failed to read file from Object Store: Connection reset');
    });
  });

  describe('serve', () => {
    const mockReqRes = (path = '/test-file.jpg') => ({
      req: { path },
      res: {
        set: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      },
      next: jest.fn()
    });

    it('should return an Express middleware function', () => {
      const middleware = objectStoreStorage.serve();

      expect(typeof middleware).toBe('function');
      expect(middleware.length).toBe(3);
    });

    it('should stream the object and set caching/response headers', async () => {
      const mockStream = { pipe: jest.fn() };
      mockS3Client.send.mockResolvedValue({
        Body: mockStream,
        ContentType: 'image/jpeg',
        ETag: '"test-etag"',
        LastModified: new Date('2025-10-30T00:00:00Z')
      });

      const { req, res, next } = mockReqRes('/test-file.jpg');
      await objectStoreStorage.serve()(req, res, next);

      expect(GetObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'content/media/test-file.jpg'
      });
      expect(res.set).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
      expect(res.set).toHaveBeenCalledWith('Cache-Control', 'public, max-age=31536000');
      expect(res.set).toHaveBeenCalledWith('ETag', '"test-etag"');
      expect(res.set).toHaveBeenCalledWith('Last-Modified', new Date('2025-10-30T00:00:00Z').toUTCString());
      expect(mockStream.pipe).toHaveBeenCalledWith(res);
      expect(next).not.toHaveBeenCalled();
    });

    it('should only set headers that are present on the S3 response', async () => {
      const mockStream = { pipe: jest.fn() };
      mockS3Client.send.mockResolvedValue({ Body: mockStream });

      const { req, res, next } = mockReqRes('/test-file.jpg');
      await objectStoreStorage.serve()(req, res, next);

      // Cache-Control is always set; the other three depend on the response
      expect(res.set).toHaveBeenCalledWith('Cache-Control', 'public, max-age=31536000');
      expect(res.set).not.toHaveBeenCalledWith('Content-Type', expect.anything());
      expect(res.set).not.toHaveBeenCalledWith('ETag', expect.anything());
      expect(res.set).not.toHaveBeenCalledWith('Last-Modified', expect.anything());
      expect(mockStream.pipe).toHaveBeenCalledWith(res);
    });

    it('should return 404 when the response body is missing', async () => {
      mockS3Client.send.mockResolvedValue({ Body: null });

      const { req, res, next } = mockReqRes('/nonexistent.jpg');
      await objectStoreStorage.serve()(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith('File not found');
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 404 when S3 throws NotFound', async () => {
      const mockError = new Error('Not Found');
      mockError.name = 'NotFound';
      mockS3Client.send.mockRejectedValue(mockError);

      const { req, res, next } = mockReqRes('/nonexistent.jpg');
      await objectStoreStorage.serve()(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith('File not found');
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 404 when S3 throws an error with statusCode 404', async () => {
      const mockError = new Error('Not Found');
      mockError.statusCode = 404;
      mockS3Client.send.mockRejectedValue(mockError);

      const { req, res, next } = mockReqRes('/nonexistent.jpg');
      await objectStoreStorage.serve()(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith('File not found');
      expect(next).not.toHaveBeenCalled();
    });

    it('should forward non-404 errors to next()', async () => {
      const mockError = new Error('Internal server error');
      mockS3Client.send.mockRejectedValue(mockError);

      const { req, res, next } = mockReqRes('/test-file.jpg');
      await objectStoreStorage.serve()(req, res, next);

      expect(next).toHaveBeenCalledWith(mockError);
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
