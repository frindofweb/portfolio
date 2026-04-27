const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PORT = 8000;

const MIMES = {
    '.html': 'text/html',
    '.js':   'application/javascript',
    '.css':  'text/css',
    '.json': 'application/json',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.svg':  'image/svg+xml',
    '.ico':  'image/x-icon',
    '.woff': 'font/woff',
    '.woff2':'font/woff2',
    '.mp4':  'video/mp4',
    '.webm': 'video/webm',
};

const IMMUTABLE_PATHS = ['/_assets/', '/_woff/', '/_runtimes/', '/_components/', '/_json/'];
const IS_COMPRESSIBLE = new Set(['text/html', 'application/javascript', 'text/css', 'application/json', 'image/svg+xml']);

function getCacheHeaders(urlPath) {
    const isImmutable = IMMUTABLE_PATHS.some((p) => urlPath.startsWith(p));
    if (isImmutable) {
        return { 'Cache-Control': 'public, max-age=31536000, immutable' };
    }
    return { 'Cache-Control': 'no-cache' };
}

function serveWithCompression(req, res, content, contentType) {
    const acceptEncoding = req.headers['accept-encoding'] || '';
    const headers = {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Vary': 'Accept-Encoding',
        ...getCacheHeaders(req.url),
    };

    if (IS_COMPRESSIBLE.has(contentType) && acceptEncoding.includes('gzip')) {
        zlib.gzip(content, (err, compressed) => {
            if (err) {
                res.writeHead(200, headers);
                res.end(content);
            } else {
                res.writeHead(200, { ...headers, 'Content-Encoding': 'gzip' });
                res.end(compressed);
            }
        });
    } else {
        res.writeHead(200, headers);
        res.end(content);
    }
}

function serveVideoWithRange(req, res, filePath, contentType) {
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = end - start + 1;
        const fileStream = fs.createReadStream(filePath, { start, end });

        res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize,
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000, immutable',
        });
        fileStream.pipe(res);
    } else {
        res.writeHead(200, {
            'Content-Length': fileSize,
            'Content-Type': contentType,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=31536000, immutable',
        });
        fs.createReadStream(filePath).pipe(res);
    }
}

http.createServer((req, res) => {
    if (req.url.startsWith('/.well-known/')) {
        res.writeHead(204);
        return res.end();
    }

    const urlPath = req.url.split('?')[0];
    let filePath = '.' + urlPath;
    if (filePath === './') filePath = './index.html';

    if (path.extname(filePath) === '') {
        const htmlVersion = filePath + '.html';
        if (fs.existsSync(htmlVersion)) filePath = htmlVersion;
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = MIMES[extname] || 'application/octet-stream';

    if (extname === '.mp4' || extname === '.webm' || MIMES[extname] === 'video/mp4') {
        if (fs.existsSync(filePath)) {
            return serveVideoWithRange(req, res, filePath, contentType);
        }
    }

    if (urlPath.startsWith('/_videos/')) {
        if (fs.existsSync(filePath)) {
            return serveVideoWithRange(req, res, filePath, 'video/mp4');
        }
    }

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                const targetUrl = 'https://friendofweb.co.uk' + urlPath;
                https.get(targetUrl, (proxyRes) => {
                    if (proxyRes.statusCode === 200) {
                        const dirname = path.dirname(filePath);
                        if (!fs.existsSync(dirname)) fs.mkdirSync(dirname, { recursive: true });
                        const chunks = [];
                        proxyRes.on('data', (c) => chunks.push(c));
                        proxyRes.on('end', () => {
                            const buf = Buffer.concat(chunks);
                            fs.writeFile(filePath, buf, () => {});
                            serveWithCompression(req, res, buf, contentType);
                            console.log(`Auto-fetched & cached: ${filePath}`);
                        });
                    } else {
                        res.writeHead(404);
                        res.end('Not Found');
                    }
                }).on('error', () => {
                    res.writeHead(502);
                    res.end('Upstream fetch error');
                });
                return;
            }
            res.writeHead(500);
            res.end('Server Error: ' + error.code);
            return;
        }

        serveWithCompression(req, res, content, contentType);
    });
}).listen(PORT, '127.0.0.1', () => {
    console.log(`Optimized server running at http://127.0.0.1:${PORT}/`);
    console.log('  ✓ Gzip compression enabled');
    console.log('  ✓ Immutable cache headers for hashed assets');
    console.log('  ✓ Video Range request support (instant scrub)');
    console.log('  ✓ Auto-fetch & cache for missing assets');
    console.log('  ✓ Page-specific patches are embedded directly in the HTML exports');
});
