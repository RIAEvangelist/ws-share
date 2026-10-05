// Generated from WS.js by scripts/browser.js.
'use strict';

(function exposeWS() {
    const wsList = new Map();
    const connections = new Set();
    let nextId = 0;
    let events;

    class WS {
        static async observe() {
            if (!events) {
                const {default: EventPubSub} = await import('event-pubsub');
                events ??= new EventPubSub();
            }
            return events;
        }

        static getConnections() {
            return Array.from(connections, describeConnection);
        }

        constructor(uri, protocols) {
            if (!uri) {
                throw new TypeError('WS requires a uri to initialize');
            }

            const address = String(uri);
            const requestedProtocols = !protocols
                ? []
                : typeof protocols !== 'string' && protocols[Symbol.iterator]
                    ? Array.from(protocols, String)
                    : [String(protocols)];
            const protocolKey = JSON.stringify(requestedProtocols);
            let sockets = wsList.get(address);
            const shared = sockets?.get(protocolKey);

            if (shared && shared.readyState < 2) {
                return shared;
            }

            const ws = new globalThis.WebSocket(address, requestedProtocols);

            if (!sockets) {
                sockets = new Map();
                wsList.set(address, sockets);
            }
            sockets.set(protocolKey, ws);

            ws.addListener = ws.addEventListener;
            ws.removeListener = ws.removeEventListener;

            Object.defineProperties(
                ws,
                {
                    uri: {enumerable: true, value: uri},
                    protocols: {enumerable: true, value: protocols},
                    on: {enumerable: true, value: ws.addEventListener},
                    off: {enumerable: true, value: ws.removeEventListener}
                }
            );

            const connection = {id: ++nextId, socket: ws, protocols: requestedProtocols};
            connections.add(connection);

            function publishOpen(event) {
                emitLifecycle(connection, 'open', event);
            }

            function publishError(event) {
                emitLifecycle(connection, 'error', event);
            }

            ws.addEventListener(
                'open',
                publishOpen,
                {once: true}
            );
            ws.addEventListener('error', publishError);
            ws.addEventListener(
                'close',
                function releaseSocket(event) {
                    ws.removeEventListener('open', publishOpen);
                    ws.removeEventListener('error', publishError);
                    connections.delete(connection);

                    // A closing connection may already have a replacement.
                    if (sockets.get(protocolKey) === ws) {
                        sockets.delete(protocolKey);
                        if (sockets.size === 0) {
                            wsList.delete(address);
                        }
                    }
                    emitLifecycle(connection, 'close', event);
                },
                {once: true}
            );

            if (events) {
                // Observer failures must not turn successful construction into a throw.
                queueMicrotask(
                    function publishCreated() {
                        emitLifecycle(connection, 'created');
                    }
                );
            }

            return ws;
        }
    }

    function describeConnection(connection) {
        return {
            id: connection.id,
            socket: connection.socket,
            url: connection.socket.url,
            protocols: [...connection.protocols],
            readyState: connection.socket.readyState
        };
    }

    function emitLifecycle(connection, type, event) {
        if (!events) {
            return;
        }
        const detail = describeConnection(connection);
        detail.event = event;
        events.emit(type, detail);
    }
    globalThis.WS = WS;
})();
