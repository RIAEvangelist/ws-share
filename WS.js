const wsList = new Map();

class WS {
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

        ws.addEventListener(
            'close',
            function releaseSocket() {
                // A closing connection may already have a replacement.
                if (sockets.get(protocolKey) !== ws) {
                    return;
                }
                sockets.delete(protocolKey);
                if (sockets.size === 0) {
                    wsList.delete(address);
                }
            },
            {once: true}
        );

        return ws;
    }
}

export {WS, WS as 'module.exports'};
export default WS;
