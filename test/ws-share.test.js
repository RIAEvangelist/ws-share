import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {once} from 'node:events';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {constants, runInNewContext} from 'node:vm';
import VanillaTest from 'vanilla-test';

const nativeWebSocket = globalThis.WebSocket;
const require = createRequire(import.meta.url);
let WS;
let moduleNumber = 0;

class SimulatedWebSocket extends EventTarget {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    readyState = SimulatedWebSocket.CONNECTING;
    registrations = [];
    sent = [];

    constructor(...args) {
        super();
        this.constructorArguments = args;
        this.url = new URL(args[0]).href;
    }

    addEventListener(...args) {
        this.registrations.push(args);
        super.addEventListener(...args);
    }

    send(...args) {
        this.sent.push(args);
        return 'native send result';
    }

    close() {
        this.readyState = SimulatedWebSocket.CLOSING;
    }

    finishOpen(event = new Event('open')) {
        this.readyState = SimulatedWebSocket.OPEN;
        this.dispatchEvent(event);
        return event;
    }

    finishClose(event = new Event('close')) {
        this.readyState = SimulatedWebSocket.CLOSED;
        this.dispatchEvent(event);
        return event;
    }
}

const cases = [
['simulated: connecting and open consumers share the supplied WebSocket instance', function shareNativeSocket() {
    const socket = new WS('ws://localhost/shared');
    assert.ok(socket instanceof SimulatedWebSocket);
    assert.strictEqual(new WS('ws://localhost/shared'), socket);
    socket.readyState = SimulatedWebSocket.OPEN;
    assert.strictEqual(new WS('ws://localhost/shared'), socket);
}],

['simulated: cache keys preserve exact addresses and ordered protocols without collisions', function preserveCacheKeys() {
    const first = new WS('ws://localhost/a', 'bc');
    assert.notStrictEqual(new WS('ws://localhost/ab', 'c'), first);
    assert.notStrictEqual(new WS('ws://LOCALHOST/a', 'bc'), first);
    assert.notStrictEqual(new WS('ws://localhost:80/a', 'bc'), first);
    assert.notStrictEqual(new WS('ws://localhost/a/', 'bc'), first);
    const ordered = new WS('ws://localhost/order', ['chat', 'updates']);
    assert.strictEqual(new WS('ws://localhost/order', ['chat', 'updates']), ordered);
    assert.notStrictEqual(new WS('ws://localhost/order', ['updates', 'chat']), ordered);
}],

['simulated: protocol shorthand shares while preserving the original metadata', function preserveProtocolMetadata() {
    const protocols = ['chat'];
    const socket = new WS('ws://localhost/protocol', protocols);
    assert.strictEqual(new WS('ws://localhost/protocol', 'chat'), socket);
    assert.strictEqual(socket.protocols, protocols);
    assert.deepEqual(socket.constructorArguments[1], protocols);
    assert.equal(socket.uri, 'ws://localhost/protocol');
    assert.throws(function overwriteUri() { socket.uri = 'ws://elsewhere'; }, TypeError);
    assert.throws(function overwriteProtocols() { socket.protocols = []; }, TypeError);
}],

['simulated: iterable protocols share by their ordered values and are consumed once', function consumeProtocolsOnce() {
    const uri = 'ws://localhost/iterable';
    const protocols = new Set(['chat']);
    const socket = new WS(uri, protocols);
    assert.notStrictEqual(new WS(uri, new Set(['other'])), socket);
    assert.strictEqual(new WS(uri, new Set(['chat'])), socket);
    assert.strictEqual(new WS(uri, ['chat']), socket);
    assert.strictEqual(new WS(uri, 'chat'), socket);
    assert.strictEqual(socket.protocols, protocols);

    const values = ['chat', 'updates'][Symbol.iterator]();
    let iterations = 0;
    const oneShot = {
        [Symbol.iterator]() {
            iterations++;
            assert.equal(iterations, 1, 'a one-use iterator must only be consumed once');
            return this;
        },
        next() {
            return values.next();
        }
    };
    const ordered = new WS(uri, oneShot);
    assert.equal(iterations, 1);
    assert.deepEqual(ordered.constructorArguments[1], ['chat', 'updates']);
    assert.strictEqual(ordered.protocols, oneShot);
    assert.strictEqual(new WS(uri, ['chat', 'updates']), ordered);
    assert.notStrictEqual(new WS(uri, ['updates', 'chat']), ordered);
}],

['simulated: every empty protocol form shares, including when it creates the socket', function shareEmptyProtocolForms() {
    const emptyForms = [undefined, null, '', []];
    for (const [index, original] of emptyForms.entries()) {
        const uri = `ws://localhost/empty/${index}`;
        const socket = new WS(uri, original);
        for (const protocols of emptyForms) {
            assert.strictEqual(new WS(uri, protocols), socket);
        }
        assert.strictEqual(socket.protocols, original);
    }
}],

['simulated: closing and closed sockets are replaced before close delivery', function replaceClosingSocket() {
    for (const state of [SimulatedWebSocket.CLOSING, SimulatedWebSocket.CLOSED]) {
        const uri = `ws://localhost/replacement/${state}`;
        const oldSocket = new WS(uri);
        oldSocket.readyState = state;
        const replacement = new WS(uri);
        assert.notStrictEqual(replacement, oldSocket);
        oldSocket.finishClose();
        assert.strictEqual(new WS(uri), replacement);
    }
}],

['simulated: close releases only its own protocol connection and allows reuse', function releaseOwnProtocol() {
    const uri = 'ws://localhost/cleanup';
    const chat = new WS(uri, 'chat');
    const updates = new WS(uri, 'updates');
    chat.finishClose();
    assert.strictEqual(new WS(uri, 'updates'), updates);
    assert.notStrictEqual(new WS(uri, 'chat'), chat);
    updates.finishClose();
    assert.notStrictEqual(new WS(uri, 'updates'), updates);
}],

['simulated: listeners receive MessageEvent data and native this; both removal aliases work', function preserveNativeListeners() {
    const socket = new WS('ws://localhost/events');
    assert.strictEqual(socket.on, socket.addEventListener);
    assert.strictEqual(socket.addListener, socket.addEventListener);
    assert.strictEqual(socket.off, socket.removeEventListener);
    assert.strictEqual(socket.removeListener, socket.removeEventListener);
    const received = [];
    function listener(event) {
        received.push({receiver: this, event});
    }
    const first = new MessageEvent('message', {data: 'launch the moon cheese'});
    socket.on('message', listener);
    socket.dispatchEvent(first);
    assert.deepEqual(received, [{receiver: socket, event: first}]);
    assert.equal(received[0].event.data, 'launch the moon cheese');
    socket.off('message', listener);
    socket.dispatchEvent(new MessageEvent('message', {data: 'removed'}));
    socket.addListener('message', listener);
    const second = new MessageEvent('message', {data: 'land the cheese'});
    socket.dispatchEvent(second);
    socket.removeListener('message', listener);
    socket.dispatchEvent(new MessageEvent('message', {data: 'removed again'}));
    assert.deepEqual(received, [
        {receiver: socket, event: first},
        {receiver: socket, event: second}
    ]);
}],

['simulated: send stays native and receives the original arguments unchanged', function preserveNativeSend() {
    const socket = new WS('ws://localhost/send');
    const payload = new Uint8Array([3, 1, 4]);
    const extraArgument = {unchanged: true};
    assert.strictEqual(socket.send, SimulatedWebSocket.prototype.send);
    assert.equal(socket.send(payload, extraArgument), 'native send result');
    assert.strictEqual(socket.sent[0][0], payload);
    assert.strictEqual(socket.sent[0][1], extraArgument);
}],

['simulated: cache hits leave consumer changes and close subscriptions alone', function preserveConsumerChanges() {
    const socket = new WS('ws://localhost/decoration');
    const registrations = [...socket.registrations];
    function consumerListenerAlias() {}
    socket.addListener = consumerListenerAlias;
    assert.strictEqual(new WS('ws://localhost/decoration'), socket);
    assert.strictEqual(socket.addListener, consumerListenerAlias);
    assert.deepEqual(socket.registrations, registrations);
}],

['simulated: missing URI and native constructor errors leave no connection or lifecycle event', async function preserveConstructorFailure() {
    const events = await WS.observe();
    const received = [];
    function receiveLifecycle(type, detail) { received.push({type, detail}); }
    events.on('*', receiveLifecycle);
    assert.throws(function missingUri() { return new WS(); }, TypeError);
    const failure = new Error('native constructor failure');
    globalThis.WebSocket = class ThrowingWebSocket {
        constructor() {
            throw failure;
        }
    };
    assert.throws(function createSocket() { return new WS('ws://localhost/retry'); }, function sameError(error) {
        return error === failure;
    });
    await Promise.resolve();
    assert.deepEqual(received, []);
    assert.deepEqual(WS.getConnections(), []);
    globalThis.WebSocket = SimulatedWebSocket;
    const socket = new WS('ws://localhost/retry');
    assert.ok(socket instanceof SimulatedWebSocket);
    await Promise.resolve();
    assert.equal(received.length, 1);
    assert.equal(received[0].type, 'created');
    assert.strictEqual(received[0].detail.socket, socket);
    events.off('*', receiveLifecycle);
}],

['simulated: ESM and CommonJS package-root/deep entries share one constructor, pool, and observer', async function shareModuleEntries() {
    const imported = await import('../WS.js');
    const commonJS = require('../');
    const deepCommonJS = require('../WS.js');
    assert.strictEqual(imported.default, imported.WS);
    assert.strictEqual(commonJS, imported.default);
    assert.strictEqual(deepCommonJS, imported.default);
    const socket = new imported.default('ws://localhost/interop');
    assert.strictEqual(new commonJS('ws://localhost/interop'), socket);
    assert.strictEqual(new deepCommonJS('ws://localhost/interop'), socket);
    const observers = await Promise.all([
        imported.default.observe(), commonJS.observe(), deepCommonJS.observe()
    ]);
    assert.strictEqual(observers[0], observers[1]);
    assert.strictEqual(observers[0], observers[2]);
    const [connection] = imported.default.getConnections();
    assert.strictEqual(connection.socket, socket);
    assert.equal(commonJS.getConnections()[0].id, connection.id);
    assert.equal(deepCommonJS.getConnections()[0].id, connection.id);
    assert.notStrictEqual(await WS.observe(), observers[0]);
    assert.deepEqual(WS.getConnections(), []);
    socket.finishClose();
}],

['simulated classic browser context: synchronous export, native events, and independent pools', async function preserveClassicEntry() {
    const source = await readFile(new URL('../ws-share-vanilla.js', import.meta.url), 'utf8');
    const browser = {WebSocket: SimulatedWebSocket};
    runInNewContext(source, browser, {filename: 'ws-share-vanilla.js'});
    assert.equal(typeof browser.WS, 'function');
    assert.equal(typeof browser.WS.observe, 'function');
    assert.equal(typeof browser.WS.getConnections, 'function');
    const socket = new browser.WS('ws://localhost/classic', 'chat');
    assert.strictEqual(new browser.WS('ws://localhost/classic', ['chat']), socket);
    assert.notStrictEqual(new WS('ws://localhost/classic', 'chat'), socket);
    let received;
    socket.on('message', function receiveMessage(event) { received = event.data; });
    socket.dispatchEvent(new MessageEvent('message', {data: 'classic moon cheese'}));
    assert.equal(received, 'classic moon cheese');
    socket.close();
    const replacement = new browser.WS('ws://localhost/classic', 'chat');
    socket.finishClose();
    assert.notStrictEqual(replacement, socket);
    assert.strictEqual(new browser.WS('ws://localhost/classic', 'chat'), replacement);
    assert.equal(browser.WS.getConnections().length, 1);
    assert.strictEqual(browser.WS.getConnections()[0].socket, replacement);
}],

['native Node WebSocket: local upgrade, sharing, and exact lifecycle event metadata', async function observeNativeSocket() {
    globalThis.WebSocket = nativeWebSocket;
    const connections = new Set();
    const server = createServer();
    const controller = new AbortController();
    const events = await WS.observe();
    const timeout = setTimeout(function expireNativeFixture() {
        controller.abort(new Error('Native WebSocket fixture exceeded 10 seconds'));
    }, 10000);
    const received = [];
    let closedSnapshot;
    function receiveLifecycle(type, detail) {
        received.push({type, detail});
        if (type === 'close') closedSnapshot = WS.getConnections();
    }
    function waitForNativeEvent(socket, type) {
        return new Promise(function waitForSocketEvent(resolve, reject) {
            const signal = controller.signal;
            signal.throwIfAborted();
            function abortWait() {
                reject(signal.reason);
            }
            socket.addEventListener(
                type,
                function receiveNativeEvent(event) {
                    signal.removeEventListener('abort', abortWait);
                    resolve(event);
                },
                {once: true, signal}
            );
            signal.addEventListener('abort', abortWait, {once: true});
        });
    }
    events.on('*', receiveLifecycle);
    server.on('upgrade', function acceptNativeConnection(request, transport) {
        connections.add(transport);
        transport.once('close', function forgetConnection() { connections.delete(transport); });
        // SHA-1 and frame length belong only to the required WebSocket wire protocol.
        const accept = createHash('sha1')
            .update(request.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
            .digest('base64');
        transport.write([
            'HTTP/1.1 101 Switching Protocols',
            'Upgrade: websocket',
            'Connection: Upgrade',
            `Sec-WebSocket-Accept: ${accept}`,
            '',
            ''
        ].join('\r\n'));
        const greeting = Buffer.from('native moon cheese');
        transport.write(Buffer.concat([Buffer.from([0x81, greeting.length]), greeting]));
        // The fixture sends one greeting; its only client input is the closing handshake.
        transport.once('data', function acknowledgeClose() {
            const reason = Buffer.from('moon cheese delivered');
            const payload = Buffer.concat([Buffer.from([0x03, 0xe8]), reason]);
            transport.end(Buffer.concat([Buffer.from([0x88, payload.length]), payload]));
        });
    });
    try {
        server.listen(0, '127.0.0.1');
        await once(server, 'listening', {signal: controller.signal});
        const uri = `ws://127.0.0.1:${server.address().port}/native`;
        const socket = new WS(uri);
        let nativeOpen;
        socket.on('open', function rememberOpen(event) { nativeOpen = event; }, {once: true});
        socket.on('error', function connectionFailed(event) {
            controller.abort(event.error ?? new Error(event.message || 'Native WebSocket failed'));
        }, {once: true});
        assert.ok(socket instanceof nativeWebSocket);
        assert.strictEqual(new WS(uri), socket);
        const [connection] = WS.getConnections();
        const message = await waitForNativeEvent(socket, 'message');
        assert.equal(message.data, 'native moon cheese');
        assert.equal(socket.readyState, nativeWebSocket.OPEN);
        assert.strictEqual(new WS(uri), socket);
        const closed = waitForNativeEvent(socket, 'close');
        socket.close(1000);
        const closeEvent = await closed;
        assert.equal(closeEvent.code, 1000);
        assert.equal(closeEvent.reason, 'moon cheese delivered');
        assert.equal(closeEvent.wasClean, true);
        assert.equal(socket.readyState, nativeWebSocket.CLOSED);
        assert.deepEqual(received.map(function eventName(item) { return item.type; }), ['created', 'open', 'close']);
        assert.equal(received[0].detail.event, undefined);
        assert.strictEqual(received[1].detail.event, nativeOpen);
        assert.strictEqual(received[2].detail.event, closeEvent);
        for (const {detail} of received) {
            assert.equal(detail.id, connection.id);
            assert.strictEqual(detail.socket, socket);
            assert.equal(detail.url, socket.url);
            assert.deepEqual(detail.protocols, []);
        }
        assert.equal(received[2].detail.readyState, nativeWebSocket.CLOSED);
        assert.deepEqual(closedSnapshot, []);
        assert.deepEqual(WS.getConnections(), []);
    } finally {
        clearTimeout(timeout);
        events.off('*', receiveLifecycle);
        for (const connection of connections) connection.destroy();
        if (server.listening) {
            await new Promise(function stopServer(resolve, reject) {
                server.close(function serverClosed(error) { error ? reject(error) : resolve(); });
            });
        }
    }
}],

['observation: concurrent observe calls resolve one shared event-pubsub instance', async function shareObserver() {
    const firstCall = WS.observe();
    assert.ok(firstCall instanceof Promise);
    const [first, second] = await Promise.all([firstCall, WS.observe()]);
    assert.strictEqual(first, second);
    assert.strictEqual(await WS.observe(), first);
    for (const method of ['on', 'once', 'off', 'emit']) assert.equal(typeof first[method], 'function');
    assert.deepEqual(WS.getConnections(), []);
}],

['observation: snapshots contain current native state and independent protocol arrays', function snapshotCurrentConnections() {
    assert.deepEqual(WS.getConnections(), []);
    const protocols = ['chat', 'updates'];
    const socket = new WS('ws://LOCALHOST:80/snapshot', protocols);
    const [first] = WS.getConnections();
    assert.equal(typeof first.id, 'number');
    assert.strictEqual(first.socket, socket);
    assert.equal(first.url, socket.url);
    assert.equal(first.readyState, SimulatedWebSocket.CONNECTING);
    assert.deepEqual(first.protocols, ['chat', 'updates']);
    protocols.push('original metadata changed');
    first.protocols.push('snapshot changed');
    first.url = 'ws://somewhere-else/';
    const second = WS.getConnections();
    assert.deepEqual(second[0].protocols, ['chat', 'updates']);
    assert.equal(second[0].url, socket.url);
    assert.equal(second[0].id, first.id);
    assert.notStrictEqual(second[0], first);
    second.pop();
    assert.equal(WS.getConnections().length, 1);
    socket.finishOpen();
    assert.equal(WS.getConnections()[0].readyState, SimulatedWebSocket.OPEN);
    socket.close();
    assert.equal(WS.getConnections()[0].readyState, SimulatedWebSocket.CLOSING);
    socket.finishClose();
    assert.deepEqual(WS.getConnections(), []);
}],

['observation: created follows construction and shared consumers add no duplicate lifecycle events', async function observeOnePhysicalConnection() {
    const events = await WS.observe();
    const received = [];
    let constructed;
    function receiveLifecycle(type, detail) { received.push({type, detail, constructed}); }
    events.on('*', receiveLifecycle);
    constructed = new WS('ws://localhost/one-physical-socket', ['chat']);
    const [connection] = WS.getConnections();
    assert.deepEqual(received, []);
    assert.strictEqual(new WS('ws://localhost/one-physical-socket', 'chat'), constructed);
    await Promise.resolve();
    assert.equal(received.length, 1);
    assert.equal(received[0].type, 'created');
    assert.strictEqual(received[0].constructed, constructed);
    assert.strictEqual(received[0].detail.socket, constructed);
    assert.equal(received[0].detail.id, connection.id);
    assert.equal(received[0].detail.event, undefined);
    const opened = constructed.finishOpen();
    constructed.finishOpen();
    assert.strictEqual(new WS('ws://localhost/one-physical-socket', 'chat'), constructed);
    await Promise.resolve();
    assert.deepEqual(received.map(function eventName(item) { return item.type; }), ['created', 'open']);
    assert.strictEqual(received[1].detail.event, opened);
    assert.equal(received[1].detail.id, connection.id);
    received[0].detail.protocols.push('observer-only change');
    assert.deepEqual(WS.getConnections()[0].protocols, ['chat']);
    assert.deepEqual(received[1].detail.protocols, ['chat']);
    events.off('*', receiveLifecycle);
}],

['observation: late subscribers see subsequent events without replay or message aggregation', async function observeExistingConnection() {
    const socket = new WS('ws://localhost/late-observer', new Set(['chat']));
    const events = await WS.observe();
    const received = [];
    function receiveLifecycle(type, detail) { received.push({type, detail}); }
    events.on('*', receiveLifecycle);
    const [connection] = WS.getConnections();
    await Promise.resolve();
    assert.deepEqual(received, []);
    const opened = socket.finishOpen();
    const firstError = new Event('error');
    const secondError = new Event('error');
    socket.dispatchEvent(firstError);
    socket.dispatchEvent(secondError);
    socket.dispatchEvent(new MessageEvent('message', {data: 'private moon cheese manifest'}));
    const closed = socket.finishClose();
    socket.finishClose();
    assert.deepEqual(received.map(function eventName(item) { return item.type; }), ['open', 'error', 'error', 'close']);
    for (const [index, event] of [opened, firstError, secondError, closed].entries()) {
        assert.strictEqual(received[index].detail.event, event);
    }
    for (const {detail} of received) {
        assert.equal(detail.id, connection.id);
        assert.strictEqual(detail.socket, socket);
        assert.equal(detail.url, socket.url);
        assert.deepEqual(detail.protocols, ['chat']);
    }
    assert.deepEqual(WS.getConnections(), []);
    events.off('*', receiveLifecycle);
}],

['observation: replacements retain closing records and old close preserves the replacement', async function observeReplacementLifecycle() {
    const events = await WS.observe();
    const first = new WS('ws://localhost/replaced', 'chat');
    const [firstRecord] = WS.getConnections();
    first.close();
    const replacement = new WS('ws://localhost/replaced', 'chat');
    const records = WS.getConnections();
    assert.equal(records.length, 2);
    assert.strictEqual(records[0].socket, first);
    assert.equal(records[0].readyState, SimulatedWebSocket.CLOSING);
    assert.strictEqual(records[1].socket, replacement);
    assert.ok(records[1].id > firstRecord.id);
    let observed;
    function receiveClose(detail) {
        observed = {detail, snapshot: WS.getConnections(), shared: new WS('ws://localhost/replaced', 'chat')};
    }
    events.on('close', receiveClose);
    const closed = first.finishClose();
    assert.equal(observed.detail.id, firstRecord.id);
    assert.strictEqual(observed.detail.socket, first);
    assert.strictEqual(observed.detail.event, closed);
    assert.strictEqual(observed.shared, replacement);
    assert.equal(observed.snapshot.length, 1);
    assert.strictEqual(observed.snapshot[0].socket, replacement);
    assert.equal(observed.snapshot[0].id, records[1].id);
    events.off('close', receiveClose);
}],

['observation: close cleanup completes before observers create another connection', async function recreateDuringClose() {
    const events = await WS.observe();
    const first = new WS('ws://localhost/reentrant-close');
    const [firstRecord] = WS.getConnections();
    let snapshot;
    let replacement;
    function receiveClose() {
        snapshot = WS.getConnections();
        replacement = new WS('ws://localhost/reentrant-close');
    }
    events.on('close', receiveClose);
    first.finishClose();
    assert.deepEqual(snapshot, []);
    assert.notStrictEqual(replacement, first);
    assert.strictEqual(new WS('ws://localhost/reentrant-close'), replacement);
    assert.ok(WS.getConnections()[0].id > firstRecord.id);
    events.off('close', receiveClose);
}],

['observation: removing one handler preserves other subscribers across socket closes', async function unsubscribeOwnHandler() {
    const events = await WS.observe();
    const firstSubscriber = [];
    const secondSubscriber = [];
    function receiveFirst(detail) { firstSubscriber.push(detail); }
    function receiveSecond(detail) { secondSubscriber.push(detail); }
    events.on('close', receiveFirst);
    events.on('close', receiveSecond);
    const first = new WS('ws://localhost/unsubscribe/first');
    first.finishClose();
    events.off('close', receiveFirst);
    const second = new WS('ws://localhost/unsubscribe/second');
    second.finishClose();
    assert.equal(firstSubscriber.length, 1);
    assert.strictEqual(firstSubscriber[0].socket, first);
    assert.equal(secondSubscriber.length, 2);
    assert.strictEqual(secondSubscriber[1].socket, second);
    events.off('close', receiveSecond);
    new WS('ws://localhost/unsubscribe/third').finishClose();
    assert.equal(secondSubscriber.length, 2);
}],

['classic VM observation: lazy public APIs use an independent event-pubsub instance', async function observeClassicEntry() {
    const source = await readFile(new URL('../ws-share-vanilla.js', import.meta.url), 'utf8');
    const browser = {WebSocket: SimulatedWebSocket, queueMicrotask};
    runInNewContext(
        source,
        browser,
        {
            filename: fileURLToPath(new URL('../ws-share-vanilla.js', import.meta.url)),
            importModuleDynamically: constants.USE_MAIN_CONTEXT_DEFAULT_LOADER
        }
    );
    const [events, sameEvents] = await Promise.all([browser.WS.observe(), browser.WS.observe()]);
    assert.strictEqual(events, sameEvents);
    assert.notStrictEqual(events, await WS.observe());
    const received = [];
    function receiveLifecycle(type, detail) { received.push({type, detail}); }
    events.on('*', receiveLifecycle);
    const socket = new browser.WS('ws://localhost/classic-observer', 'chat');
    assert.equal(browser.WS.getConnections().length, 1);
    assert.deepEqual(WS.getConnections(), []);
    await Promise.resolve();
    const opened = socket.finishOpen();
    const closed = socket.finishClose();
    assert.deepEqual(received.map(function eventName(item) { return item.type; }), ['created', 'open', 'close']);
    assert.strictEqual(received[1].detail.event, opened);
    assert.strictEqual(received[2].detail.event, closed);
    assert.equal(browser.WS.getConnections().length, 0);
    events.off('*', receiveLifecycle);
}]
];

const test = new VanillaTest();
for (const [description, runCase] of cases) {
    test.expects(description);
    try {
        globalThis.WebSocket = SimulatedWebSocket;
        const source = new URL(`../WS.js?test=${++moduleNumber}`, import.meta.url);
        WS = (await import(source)).default;
        await runCase();
        test.pass();
    } catch (error) {
        console.error(error);
        test.fail();
    } finally {
        globalThis.WebSocket = nativeWebSocket;
        test.done();
    }
}
const result = test.report();
process.exitCode = result.ok ? 0 : 1;
