# Ghost Object Store Storage Adapter

An Object Store storage adapter for Ghost CMS that allows storing images and other files in object storage instead of the local file system.

Works with any object storage service that uses an S3-compatible API including Cloudflare R2, MinIO, DigitalOcean Spaces, Wasabi, and Amazon S3.

**NOTE**: Only MinIO and Amazon S3 have been tested extensively so your mileage may vary with others.


## Features

- Store images and files in object storage
- Automatically serve files from the object storage
- Support for all Ghost image storage operations (save, delete, exists, read, serve)
- Additionally supports the `saveRaw` operation for raw file uploads
- Full compatibility with Ghost's storage adapter system
- S3-compatible interface using AWS SDK v3


## Installation

To get the adapter working, first, use `npm` to install it then move it to your Ghost installation's `content/adapters/storage` directory.

To achieve this, run the following commands:

```bash
mkdir -p /var/lib/ghost/content/adapters/storage/object-store
npm install https://github.com/CodeForAfrica/ghost-object-store-storage-adapter.git --omit=dev
cp -r ./node_modules/ghost-object-store-storage-adapter/* /var/lib/ghost/content/adapters/storage/object-store
```

Once this is done, proceed to configure the adapter as described below.

## Configuration

Add the following configuration to your Ghost config.js file (or environment variables):

```json
{
  "storage": {
    "active": "object-store",
    "media":{
      "adapter": "object-store"
    },
    "files": {
      "adapter": "object-store"
    },
    "objectStore": {
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
storage__objectStore__endpoint: localhost:9000
storage__objectStore__accessKey: youracesskey
storage__objectStore__secretKey: yoursecretkey
storage__objectStore__bucket: bucket
storage__objectStore__region: your-desired-region
storage__objectStore__useSSL: false
```


## Requirements

- Ghost 6.4.0+
- Node.js 18+


## Testing

To run tests:
```bash
npm run test
```

To run tests in watch mode:
```bash
npm run test:watch
```

To run tests with coverage:
```bash
npm run test:coverage
```


## Development

To develop this adapter locally:

1. Clone the repository
2. Run npm install
3. Make changes to index.js (This is the main adapter file)
4. Profit?


## License

MIT License

Copyright (c) 2025 Code for Africa

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
