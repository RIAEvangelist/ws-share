import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';

const routes = new Map(
    [
        ['/', ['docs/index.html', 'text/html; charset=utf-8']],
        ['/ws-share-header.svg', ['docs/ws-share-header.svg', 'image/svg+xml']],
        ['/WS.js', ['WS.js', 'text/javascript; charset=utf-8']],
        ['/ws-share-vanilla.js', ['ws-share-vanilla.js', 'text/javascript; charset=utf-8']],
        ['/examples/echo/', ['examples/echo/index.html', 'text/html; charset=utf-8']],
        ['/examples/echo/js/app.js', ['examples/echo/js/app.js', 'text/javascript; charset=utf-8']]
    ]
);
const port = Number(process.env.PORT || 8080);
const server = createServer(serve);

server.on('error', reportError);
server.listen(port, '127.0.0.1', listening);

async function serve(request, response) {
    const route = routes.get(new URL(request.url, 'http://localhost').pathname);
    if (!route) {
        response.writeHead(404);
        response.end('Not found');
        return;
    }
    try {
        const content = await readFile(new URL(route[0], import.meta.url));
        response.writeHead(200, {'Content-Type': route[1]});
        response.end(content);
    } catch (error) {
        console.error(error);
        response.writeHead(500);
        response.end('Could not read the requested file.');
    }
}

function listening() {
    console.log(`Documentation: http://127.0.0.1:${server.address().port}/`);
    console.log(`Echo example: http://127.0.0.1:${server.address().port}/examples/echo/`);
}

function reportError(error) {
    console.error(error);
    process.exitCode = 1;
}
