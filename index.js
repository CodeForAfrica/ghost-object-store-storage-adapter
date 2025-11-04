'use strict';

const StorageBase = require('ghost-storage-base');
const { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

/**
 * Object Store Storage Adapter for Ghost
 *
 * This adapter allows Ghost to store images and other files in Object Stores that use an S3-compatible API.
 * It extends the base StorageBase class and implements all required methods.
 * It additionally implements saveRaw which is required for saving buffers.
 */
class ObjectStoreStorage extends StorageBase {
  constructor(options = {}) {
    // Default configuration (Mostly for dev. You should definitely change these.)
    const defaultOptions = {
      endpoint: process.env.storage__object_store__endpoint || 'http://minio:9000',
      accessKey: process.env.storage__object_store__accessKey,
      secretKey: process.env.storage__object_store__secretKey,
      bucket: process.env.storage__object_store__bucket || 'ghost',
      region: process.env.storage__object_store__region || 'eu-west-1',
      useSSL: process.env.storage__object_store__useSSL === 'true' || false,
      // For Ghost's static file handling
      storagePath: process.env.storage__object_store__storagePath || 'content/media/',
      staticFileURLPrefix: process.env.storage__object_store__staticFileURLPrefix || 'content/media/',
    };

    // Merge provided options with defaults
    const config = { ...defaultOptions, ...options };

    super();

    // Store ObjectStore-specific configuration
    this.endpoint = config.endpoint;
    this.accessKey = config.accessKey;
    this.secretKey = config.secretKey;
    this.bucket = config.bucket;
    this.region = config.region;
    this.useSSL = config.useSSL;
    this.storagePath = config.storagePath;
    this.staticFileURLPrefix = config.staticFileURLPrefix;

    // Initialize S3 client
    this.s3Client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey
      },
      forcePathStyle: true,
      tls: config.useSSL
    });
  }

  /**
   * Saves the file to Object Store
   * Returns a promise which ultimately returns the object key (path in bucket) of the uploaded file
   *
   * @param {StorageBase.Image} file
   * @param {String} targetDir
   * @returns {Promise<String>}
   */
  async save(file, targetDir) {
    console.log('Saving file to Object Store:', file);
    console.log('Target directory:', targetDir);
    const storagePath = this.getTargetDir(this.storagePath);
    console.log('Storage Path', storagePath);
    // Get a unique filename (using the base class method)
    const fileName = await this.getUniqueFileName(file, storagePath);

    const objectKey = fileName.replace(/\\/g, '/');

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
      Body: file.contents || file.path,
      ContentType: file.type
    });

    try {
      await this.s3Client.send(command);

      return `/${objectKey}`;
    } catch (error) {
      throw new Error(`Failed to save file to Object Store: ${error.message}`);
    }
  }

  /**
   * Saves a buffer to targetPath in Object Store
   * Returns a promise which ultimately returns the object key (path in bucket) of the uploaded file
   *
   * @param {Buffer} buffer is an instance of Buffer
   * @param {String} targetPath relative path NOT including storage path to which the buffer should be written
   * @returns {Promise<String>} a URL to retrieve the data
   */
  async saveRaw(buffer, targetPath) {
    const objectKey = `${this.staticFileURLPrefix}${targetPath.replace(/\\/g, '/')}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
      Body: buffer
    });

    try {
      await this.s3Client.send(command);

      return `/${objectKey}`;
    } catch (error) {
      throw new Error(`Failed to save buffer to Object Store: ${error.message}`);
    }
  }

  /**
   * Checks if a file exists in Object Store
   *
   * @param {String} fileName
   * @param {String} targetDir
   * @returns {Promise<Boolean>}
   */
  async exists(fileName, targetDir) {
    const objectKey = (targetDir ? `${targetDir}/` : '') + fileName;

    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: objectKey
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      if (error.name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Deletes a file from Object Store
   *
   * @param {String} fileName
   * @param {String} targetDir
   * @returns {Promise<void>}
   */
  async delete(fileName, targetDir) {
    const objectKey = (targetDir ? `${targetDir}/` : '') + fileName;

    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: objectKey
    });

    try {
      await this.s3Client.send(command);
    } catch (error) {
      throw new Error(`Failed to delete file from Object Store: ${error.message}`);
    }
  }

  /**
   * Reads bytes from Object Store for a target file
   *
   * @param {Object} options
   * @returns {Promise<Buffer>}
   */
  async read(options) {
    const objectKey = options.path;

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: objectKey
      });

      const response = await this.s3Client.send(command);

      // Convert stream to buffer
      const chunks = [];
      for await (const chunk of response.Body) {
        chunks.push(chunk);
      }

      return Buffer.concat(chunks);
    } catch (error) {
      if (error.name === 'NoSuchKey') {
        throw new Error(`File not found: ${options.path}`);
      }

      throw new Error(`Failed to read file from Object Store: ${error.message}`);
    }
  }

  /**
   * Serves static files from Object Store
   *
   * @returns {Function} Express middleware function
   */
  serve() {
    // Return Express middleware function that serves files from ObjectStore
    return async (req, res, next) => {
      try {
        // Extract the file path from the request
        const filePath = req.path.substring(1); // Remove leading slash
        // Convert the file path to ObjectStore object key
        const objectKey = `${this.staticFileURLPrefix}${filePath}`;

        // Get the file from ObjectStore
        const command = new GetObjectCommand({
          Bucket: this.bucket,
          Key: objectKey
        });

        const response = await this.s3Client.send(command);

        // Set appropriate response headers
        if (response.ContentType) {
          res.set('Content-Type', response.ContentType);
        }

        // TODO: Move this magic number to a constant/config?
        res.set('Cache-Control', 'public, max-age=31536000');

        if (response.ETag) {
          res.set('ETag', response.ETag);
        }

        if (response.LastModified) {
          res.set('Last-Modified', new Date(response.LastModified).toUTCString());
        }
        // End set headers

        // Stream the file content to the client
        if (response.Body) {
          response.Body.pipe(res);
        } else {
          res.status(404).send('File not found');
        }
      } catch (error) {
        // Handle error cases
        if (error.name === 'NotFound' || error.statusCode === 404) {
          // File not found - return 404
          res.status(404).send('File not found');
        } else {
          // Other errors - pass to next middleware
          next(error);
        }
      }
    };
  }
}

module.exports = ObjectStoreStorage;
