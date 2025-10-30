# Ghost Object Store Storage Adapter

An Object Store storage adapter for Ghost CMS that allows storing images and other files in object storage instead of the local file system.

Works with any S3-compatible object storage service including Cloudflare R2, MinIO, DigitalOcean Spaces, Wasabi, and Amazon S3.

**NOTE**: Only MinIO and Amazon S3 have been tested extensively so your mileage may vary with others.


## Features

- Store images and files in object storage
- Automatically serve files from the object storage
- Support for all Ghost image storage operations (save, delete, exists, read, serve)
- Full compatibility with Ghost's storage adapter system
- S3-compatible interface using AWS SDK v3


## Installation

```bash:
pnpm install ghost-object-store-storage-adapter
mkdir -p /var/lib/ghost/content/adapters/storage/object-store
cp -r node_modules/ghost-object-store-storage-adapter/* /var/lib/ghost/content/adapters/storage/object-store
```


## Configuration

Add the following configuration to your Ghost config.js file (or environment variables):

```javascript
{
  "storage": {
    "active": "object-store",
    "media":{
      "adapter": "object-store"
    },
    "files": {
      "adapter": "object-store"
    },
    "object_store": {
      "endpoint": "localhost:9000",
      "accessKey": "youracesskey",
      "secretKey": "yoursecretkey",
      "bucket": "ghost",
      "region": "eu-west-1",
      "useSSL": false
    }
  }
}
```


### Environment Variables

Alternatively, you can set these environment variables in Ghost:

```bash
storage__active: object-store
storage__files__adapter: object-store
storage__media__adapter: object-store
storage__object_store__endpoint: localhost:9000
storage__object_store__accessKey: youracesskey
storage__object_store__secretKey: yoursecretkey
storage__object_store__bucket: bucket
storage__object_store__region: your-desired-region
storage__object_store__useSSL: false
```


## Requirements

- Ghost 6.5.3+
- Node.js 18+


## Testing

To run tests:
```bash
pnpm test
```

To run tests in watch mode:
```bash
pnpm run test:watch
```

To run tests with coverage:
```bash
pnpm run test:coverage
```


## Development

To develop this adapter locally:

1. Clone the repository
2. Run pnpm install
3. Make changes to index.js (This is the main adapter file)
4. Profit?


## License

MIT
