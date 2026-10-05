[![ws-share — one WebSocket, many modules](https://raw.githubusercontent.com/RIAEvangelist/ws-share/main/docs/ws-share-header.svg)](https://riaevangelist.github.io/ws-share/)

# ws-share

Share native WebSockets between JavaScript modules, components and scripts in Node.js and browsers. Zero runtime dependencies, one isomorphic implementation, and a small API.

[Documentation](https://riaevangelist.github.io/ws-share/) · [Quick start](https://riaevangelist.github.io/ws-share/#start) · [Browser](https://riaevangelist.github.io/ws-share/#browser) · [API](https://riaevangelist.github.io/ws-share/#api) · [Connection lifecycle](https://riaevangelist.github.io/ws-share/#sharing) · [Upgrade](https://riaevangelist.github.io/ws-share/#upgrade)

[![npm version](https://img.shields.io/npm/v/ws-share.svg)](https://www.npmjs.com/package/ws-share)
[![npm downloads](https://img.shields.io/npm/dm/ws-share.svg)](https://www.npmjs.com/package/ws-share)
[![Node.js support](https://img.shields.io/badge/node-%3E%3D22.13-339933?logo=nodedotjs&logoColor=white)](https://riaevangelist.github.io/ws-share/#upgrade)
[![runtime dependencies](https://img.shields.io/badge/runtime_dependencies-0-c5f36b)](https://www.npmjs.com/package/ws-share?activeTab=dependencies)
[![license](https://img.shields.io/npm/l/ws-share.svg)](./licence.md)

## Quick start

```sh
npm install ws-share
```

Replace the example address with your application's WebSocket server:

```javascript
import WS from 'ws-share';

const airlock = new WS('wss://moon.example/control');
const cafe = new WS('wss://moon.example/control');

console.log(airlock === cafe); // true

function receiveOrder(event) {
    console.log('Moon cafe:', event.data);
}

cafe.on('message', receiveOrder);

function orderCoffee() {
    airlock.send('One espresso. Low gravity. Extra lid.');
}

if (airlock.readyState === WebSocket.OPEN) {
    orderCoffee();
} else {
    airlock.on(
        'open',
        orderCoffee,
        {once: true}
    );
}
```

A shared connection may already be open. Check `readyState` before waiting for `open`.

CommonJS receives the same constructor:

```javascript
const WS = require('ws-share');
```

Both loaders use the same synchronous `WS.js` source on Node.js 22.13 and newer. Browsers and workers use their native `globalThis.WebSocket` through that same source.

## Browser use

A native browser import map resolves the package name directly to the installed source:

```html
<script type="importmap">
{
    "imports": {
        "ws-share": "./node_modules/ws-share/WS.js"
    }
}
</script>
<script type="module">
    import WS from 'ws-share';

    const socket = new WS('wss://moon.example/control');

    function receiveMessage(event) {
        console.log(event.data);
    }

    socket.on('message', receiveMessage);
</script>
```

Import-map URLs are relative to the HTML document. Serve the page over HTTP(S), and expose the mapped file at that URL. You can also import `WS.js` by URL directly or let a bundler resolve the ordinary package import.

For a classic script, load the browser entry before using its `WS` global:

```html
<script src="./node_modules/ws-share/ws-share-vanilla.js"></script>
<script>
    const socket = new WS('wss://moon.example/control');
</script>
```

The classic entry is generated from the same source for script-tag consumers. Choose one loading style per application; classic scripts and ES modules have separate connection pools.

## API

`new WS(uri, protocols?)` returns the shared native WebSocket itself. The protocol argument accepts a string or an iterable of strings, such as an ordered array. A missing URI throws a `TypeError`; the native WebSocket constructor handles URL and protocol errors.

| Member | Purpose |
| --- | --- |
| `uri` | Read-only URI supplied when the socket was created. |
| `protocols` | Read-only property containing the originally requested protocols; native `protocol` reports the negotiated value. |
| `on(type, listener, options?)`, `addListener(...)` | Aliases for native `addEventListener`. |
| `off(type, listener, options?)`, `removeListener(...)` | Aliases for native `removeEventListener`. |
| `send(data)`, `close(code?, reason?)` | Native operations on the shared connection. |
| `readyState`, `bufferedAmount`, `binaryType`, `url`, `protocol`, `extensions` | Native WebSocket state and configuration. |

Listeners receive native event objects. Read a message from `event.data`. Listener aliases return `undefined`, just like the corresponding EventTarget methods.

## Connection sharing and cleanup

A matching exact URI string and ordered protocol list reuse a socket while it is `CONNECTING` or `OPEN`. `'chat'` and `['chat']` identify the same protocol list; an omitted or empty protocol argument identifies the empty list. Protocol order matters, and URI spelling is preserved.

A `CLOSING` or `CLOSED` socket is replaced on the next request. A closing socket's later `close` event leaves its replacement intact. There is no automatic reconnect; existing holders retain their original socket until they ask for another one.

Every holder receives the same socket object. Calling `close()` closes it for every module; changing `binaryType` affects every listener. Let the application own the connection's lifetime. Remove a component's listener when the component goes away:

```javascript
function showCafeMessage(event) {
    console.log(event.data);
}

socket.on('message', showCafeMessage);

// Run during this component's cleanup.
socket.off('message', showCafeMessage);
```

Use event listeners when modules need independent handlers. Assigning `socket.onmessage` replaces the socket's single property handler.

Sharing is scoped to a loaded implementation. Separate processes, browser tabs, workers, package copies and loading styles have separate pools. The application owns its message format, reconnect policy and final connection cleanup.

## Upgrading from 2.x

Version 3.0.0 uses native WebSocket clients throughout:

- Node.js 22.13 or newer is required; browsers and workers need a native `WebSocket`.
- Both `import WS from 'ws-share'` and `const WS = require('ws-share')` return the same constructor in Node.
- Node message listeners now receive a `MessageEvent`; read `event.data`. Native close events expose `event.code` and `event.reason`.
- Binary messages follow native `binaryType` behavior. Set `socket.binaryType = 'arraybuffer'` when your handler needs an `ArrayBuffer`, and update code that expected a Node `Buffer`.
- Node-specific `ws` extensions such as `ping`, `pong`, `terminate` and EventEmitter methods are outside the native WebSocket API. Use the standard client API when upgrading.
- `on`, `off`, `addListener` and `removeListener` follow EventTarget semantics, including listener options and an `undefined` return value.
- The classic browser `WS` entry remains available. The package uses native JavaScript without webpack or a separate Node bundle.

See the [release notes](https://github.com/RIAEvangelist/ws-share/releases) for the complete release history.

## Run the examples

From the repository, run `npm start` and open `http://127.0.0.1:8080/` for the documentation or `http://127.0.0.1:8080/examples/echo/` for the browser example. Enter your WebSocket echo server's address to send and receive a message through one shared socket.

Run the Node example against the same server:

```sh
node examples/echo/node/echo.js ws://localhost:8081
```

The examples and documentation server use Node's built-in modules. No dependency installation or bundler is needed.

## License

[DBAD Public License](./licence.md) · Brandon Nozaki Miller
