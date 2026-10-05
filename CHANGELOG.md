# Changelog

## 3.0.0

- Use the native `WebSocket` in Node.js 22.13+ and modern browsers, with zero runtime or development dependencies.
- Load the same synchronous `WS.js` implementation through ESM and CommonJS. Keep the classic browser `WS` global with a small script generated from that source.
- Reuse connecting and open sockets through URI and ordered-protocol maps. Return cached connections before decorating listeners or properties again.
- Keep distinct URI/protocol pairs separate and prevent a closing socket from evicting its replacement.
- Replace the old React/Webpack demo with plain JavaScript and remove the obsolete build dependencies.
- Refresh the README, header, examples, and GitHub Pages documentation.

### Upgrade from 2.x

Node.js now requires 22.13 or newer. Both Node and browsers deliver standard event objects: read message content from `event.data`. The `ws` package is no longer used; its Node-specific extensions such as `ping()`, `terminate()`, and EventEmitter methods beyond the documented listener aliases are outside this native client API. `send()`, `close()`, and all standard WebSocket capabilities remain available on the returned native socket.

`on`, `off`, `addListener`, and `removeListener` use native EventTarget behavior, including its listener deduplication and return values. Missing URI errors are now `TypeError` objects. An omitted protocol list and an empty list share the same connection; a string protocol and its one-element array also share. Protocol order remains significant.

Every holder receives the same socket. Closing it closes the connection for all holders. Remove a component's own listeners with `off()` when that component is finished. The cache belongs to one loaded module instance or classic script; use one loading style consistently in a JavaScript realm.
