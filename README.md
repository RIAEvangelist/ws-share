[![ws-share — one WebSocket, many modules](https://raw.githubusercontent.com/RIAEvangelist/ws-share/main/docs/ws-share-header.svg)](https://riaevangelist.github.io/ws-share/)

# ws-share

Share native WebSockets between JavaScript modules, components and scripts in Node.js and browsers. One isomorphic implementation, a small API, and optional connection lifecycle events through `event-pubsub`.

[Documentation](https://riaevangelist.github.io/ws-share/) · [Quick start](https://riaevangelist.github.io/ws-share/#start) · [Browser](https://riaevangelist.github.io/ws-share/#browser) · [API](https://riaevangelist.github.io/ws-share/#api) · [Connection lifecycle](https://riaevangelist.github.io/ws-share/#sharing) · [Observe](https://riaevangelist.github.io/ws-share/#observe) · [Upgrade](https://riaevangelist.github.io/ws-share/#upgrade)

[![npm version](https://img.shields.io/npm/v/ws-share.svg)](https://www.npmjs.com/package/ws-share)
[![npm downloads](https://img.shields.io/npm/dm/ws-share.svg)](https://www.npmjs.com/package/ws-share)
[![Node.js support](https://img.shields.io/badge/node-%3E%3D22.13-339933?logo=nodedotjs&logoColor=white)](https://riaevangelist.github.io/ws-share/#upgrade)
[![lifecycle dependency](https://img.shields.io/badge/lifecycle-event--pubsub_6.1.1-c5f36b)](https://www.npmjs.com/package/ws-share?activeTab=dependencies)
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

The package installs `event-pubsub` 6.1.1 and its runtime dependency `strong-type` 2.0.0. They load only when you call `WS.observe()`; construction and ordinary socket use remain synchronous. `vanilla-test` is a development dependency for this repository's tests.

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

### Browser lifecycle observation

For `WS.observe()`, add the dependency mappings before loading your scripts. This example assumes the packages are installed in the page's `node_modules` directory; map them to their actual served locations:

```html
<script type="importmap">
{
    "imports": {
        "ws-share": "./node_modules/ws-share/WS.js",
        "event-pubsub": "./node_modules/event-pubsub/index.js",
        "strong-type": "./node_modules/strong-type/index.js"
    }
}
</script>
<script type="module">
    import WS from 'ws-share';

    const events = await WS.observe();

    function showAirlockState(type, connection) {
        console.log('Moon airlock:', type, connection.id, connection.readyState);
    }

    events.on('*', showAirlockState);
    console.table(WS.getConnections());

    const airlock = new WS('wss://moon.example/control');
</script>
```

The same dependency mappings apply when importing `WS.js` directly by URL. A classic script can call `await WS.observe()` inside an async function after the import map and `ws-share-vanilla.js` have loaded:

```html
<script src="./node_modules/ws-share/ws-share-vanilla.js"></script>
<script>
    async function watchAirlock() {
        const events = await WS.observe();

        function showAirlockState(type, connection) {
            console.log('Moon airlock:', type, connection.id, connection.readyState);
        }

        events.on('*', showAirlockState);
        console.table(WS.getConnections());
        const airlock = new WS('wss://moon.example/control');
    }

    function reportObservationError(error) {
        console.error(error);
    }

    watchAirlock().catch(reportObservationError);
</script>
```

`WS.observe()` rejects if its dependency import fails. Node resolves installed packages normally; browser documents need the mappings above or a bundler that resolves these imports. Workers need an equivalent module-resolution setup from their host or bundler.

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

| Static method | Purpose |
| --- | --- |
| `await WS.observe()` | Load the observer dependency and resolve the one shared `EventPubSub` instance for this loaded implementation. Repeated and concurrent calls resolve the same instance. |
| `WS.getConnections()` | Return a fresh array of current connection records synchronously. Works before observation is enabled. |

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

## Observe connection lifecycle

Subscribe first, then take a snapshot without an `await` between those two operations. The snapshot supplies current state; subscriptions supply subsequent lifecycle events:

A socket can appear in the snapshot before its queued `created` event arrives. Maintain connection lists by `id` so that notification updates the existing entry.

```javascript
import WS from 'ws-share';

const events = await WS.observe();

function showAirlockState(type, connection) {
    console.log('Moon airlock:', type, connection.id, connection.readyState);
}

events.on('*', showAirlockState);
console.table(WS.getConnections());

const airlock = new WS('wss://moon.example/control');

// Run when this observer's component goes away.
function stopWatchingAirlock() {
    events.off('*', showAirlockState);
}
```

The wildcard handler receives `(type, connection)`. A handler registered for one event receives only `connection`. Use `events.once('open', handler)` for the next opening across this implementation, or `events.on('close', handler)` for every close. Remove the exact handler with `events.off(type, handler)`. The bus is shared by every observer; `events.reset()` removes every observer's subscriptions, so component cleanup should use `off()`.

### Connection records

Each `WS.getConnections()` record contains:

| Field | Meaning |
| --- | --- |
| `id` | Increasing numeric identity assigned once per physical connection during this implementation's lifetime. A replacement receives a new ID. |
| `socket` | The exact native WebSocket returned by `new WS(...)`. |
| `url` | The native socket's `url`, including any URL context the application supplied. |
| `protocols` | A fresh array of the requested protocol strings in their original order. Native `socket.protocol` reports the negotiated value. |
| `readyState` | Native numeric state when this record was created: `0` connecting, `1` open, `2` closing, or `3` closed. |

The array and records are fresh shallow snapshots, and each protocol array is copied. The referenced socket stays live. Records remain tracked until their native `close` event, including an older closing socket after a replacement has been created. Closed history is not retained.

### Events and timing

Every lifecycle payload contains the connection fields above plus `event`:

| Event | When it is emitted | `event` |
| --- | --- | --- |
| `created` | After a new native connection is constructed, in a queued microtask after the constructor returns. Observation must already be enabled when construction happens. | `undefined` |
| `open` | When the native socket opens. | The original native open event. |
| `error` | When the native socket reports an error. | The original native error event; available details depend on the platform. |
| `close` | After the native socket closes and its tracking/cache cleanup finishes. | The original native close event, including `code`, `reason`, and `wasClean`. |

Enabling observation does not replay earlier events. Reusing a connecting or open socket creates no additional `created` or `open` event. A replaced closing socket still emits its own later `close`; cleanup preserves its replacement. A close handler's new snapshot therefore excludes the connection that just closed.

Event handlers run synchronously through `event-pubsub`; handle failures inside your observer when it must keep other observers running. A thrown handler stops the remaining handlers for that emission, and returned promises are not awaited. A `created` handler runs after construction has returned, and failures in native lifecycle handlers follow the platform's event-error reporting.

Observation adds no per-socket pub/sub instance and leaves the native listener aliases intact. ws-share does not log, persist, or redact records; URLs can carry private application context, and the application owns how it handles them. Message handling, heartbeat, reconnection, reference counting, routing, and delivery guarantees remain application or transport responsibilities.

The observer can report only events the runtime delivers while its realm is running. It cannot supply a missing native close event or notify after the page, worker, or process has ended.

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

Version 3.1.0 adds the static observation methods without changing construction, reuse, or native socket behavior. Existing socket-only browser code keeps its current imports. Browser code adopting `WS.observe()` also needs the dependency mappings shown above.

## Run the examples

From the repository, run `npm start` and open `http://127.0.0.1:8080/` for the documentation or `http://127.0.0.1:8080/examples/echo/` for the browser example. Enter your WebSocket echo server's address to send and receive a message through one shared socket.

Run the Node example against the same server:

```sh
node examples/echo/node/echo.js ws://localhost:8081
```

The echo examples and documentation server use Node's built-in modules. Lifecycle observation additionally loads the installed runtime dependencies; no bundler is required with the browser import map above.

## License

[DBAD Public License](./licence.md) · Brandon Nozaki Miller
