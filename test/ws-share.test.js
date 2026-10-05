import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {once} from 'node:events';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {afterEach, beforeEach, test} from 'node:test';
import {runInNewContext} from 'node:vm';

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

    finishClose() {
        this.readyState = SimulatedWebSocket.CLOSED;
        this.dispatchEvent(new Event('close'));
    }
}

beforeEach(async function useIsolatedSimulatedSocketPool() {
    globalThis.WebSocket = SimulatedWebSocket;
    const source = new URL(`../WS.js?test=${++moduleNumber}`, import.meta.url);
    WS = (await import(source)).default;
});

afterEach(function restoreNativeWebSocket() {
    globalThis.WebSocket = nativeWebSocket;
});

test('simulated: connecting and open consumers share the supplied WebSocket instance', function () {
    const socket = new WS('ws://localhost/shared');
    assert.ok(socket instanceof SimulatedWebSocket);
    assert.strictEqual(new WS('ws://localhost/shared'), socket);
    socket.readyState = SimulatedWebSocket.OPEN;
    assert.strictEqual(new WS('ws://localhost/shared'), socket);
});

test('simulated: cache keys preserve exact addresses and ordered protocols without collisions', function () {
    const first = new WS('ws://localhost/a', 'bc');
    assert.notStrictEqual(new WS('ws://localhost/ab', 'c'), first);
    assert.notStrictEqual(new WS('ws://LOCALHOST/a', 'bc'), first);
    assert.notStrictEqual(new WS('ws://localhost:80/a', 'bc'), first);
    assert.notStrictEqual(new WS('ws://localhost/a/', 'bc'), first);
    const ordered = new WS('ws://localhost/order', ['chat', 'updates']);
    assert.strictEqual(new WS('ws://localhost/order', ['chat', 'updates']), ordered);
    assert.notStrictEqual(new WS('ws://localhost/order', ['updates', 'chat']), ordered);
});

test('simulated: protocol shorthand shares while preserving the original metadata', function () {
    const protocols = ['chat'];
    const socket = new WS('ws://localhost/protocol', protocols);
    assert.strictEqual(new WS('ws://localhost/protocol', 'chat'), socket);
    assert.strictEqual(socket.protocols, protocols);
    assert.deepEqual(socket.constructorArguments[1], protocols);
    assert.equal(socket.uri, 'ws://localhost/protocol');
    assert.throws(function overwriteUri() { socket.uri = 'ws://elsewhere'; }, TypeError);
    assert.throws(function overwriteProtocols() { socket.protocols = []; }, TypeError);
});

test('simulated: iterable protocols share by their ordered values and are consumed once', function () {
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
});

test('simulated: every empty protocol form shares, including when it creates the socket', function () {
    const emptyForms = [undefined, null, '', []];
    for (const [index, original] of emptyForms.entries()) {
        const uri = `ws://localhost/empty/${index}`;
        const socket = new WS(uri, original);
        for (const protocols of emptyForms) {
            assert.strictEqual(new WS(uri, protocols), socket);
        }
        assert.strictEqual(socket.protocols, original);
    }
});

test('simulated: closing and closed sockets are replaced before close delivery', function () {
    for (const state of [SimulatedWebSocket.CLOSING, SimulatedWebSocket.CLOSED]) {
        const uri = `ws://localhost/replacement/${state}`;
        const oldSocket = new WS(uri);
        oldSocket.readyState = state;
        const replacement = new WS(uri);
        assert.notStrictEqual(replacement, oldSocket);
        oldSocket.finishClose();
        assert.strictEqual(new WS(uri), replacement);
    }
});

test('simulated: close releases only its own protocol connection and allows reuse', function () {
    const uri = 'ws://localhost/cleanup';
    const chat = new WS(uri, 'chat');
    const updates = new WS(uri, 'updates');
    chat.finishClose();
    assert.strictEqual(new WS(uri, 'updates'), updates);
    assert.notStrictEqual(new WS(uri, 'chat'), chat);
    updates.finishClose();
    assert.notStrictEqual(new WS(uri, 'updates'), updates);
});

test('simulated: listeners receive MessageEvent data and native this; both removal aliases work', function () {
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
});

test('simulated: send stays native and receives the original arguments unchanged', function () {
    const socket = new WS('ws://localhost/send');
    const payload = new Uint8Array([3, 1, 4]);
    const extraArgument = {unchanged: true};
    assert.strictEqual(socket.send, SimulatedWebSocket.prototype.send);
    assert.equal(socket.send(payload, extraArgument), 'native send result');
    assert.strictEqual(socket.sent[0][0], payload);
    assert.strictEqual(socket.sent[0][1], extraArgument);
});

test('simulated: cache hits leave consumer changes and close subscriptions alone', function () {
    const socket = new WS('ws://localhost/decoration');
    const registrations = [...socket.registrations];
    function consumerListenerAlias() {}
    socket.addListener = consumerListenerAlias;
    assert.strictEqual(new WS('ws://localhost/decoration'), socket);
    assert.strictEqual(socket.addListener, consumerListenerAlias);
    assert.deepEqual(socket.registrations, registrations);
});

test('simulated: missing URI and native constructor errors surface without poisoning the pool', function () {
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
    globalThis.WebSocket = SimulatedWebSocket;
    assert.ok(new WS('ws://localhost/retry') instanceof SimulatedWebSocket);
});

test('simulated: ESM and CommonJS package-root/deep entries share one constructor and pool', async function () {
    const imported = await import('../WS.js');
    const commonJS = require('../');
    const deepCommonJS = require('../WS.js');
    assert.strictEqual(imported.default, imported.WS);
    assert.strictEqual(commonJS, imported.default);
    assert.strictEqual(deepCommonJS, imported.default);
    const socket = new imported.default('ws://localhost/interop');
    assert.strictEqual(new commonJS('ws://localhost/interop'), socket);
    assert.strictEqual(new deepCommonJS('ws://localhost/interop'), socket);
});

test('simulated classic browser context: synchronous global export, events, and independent pools', async function () {
    const source = await readFile(new URL('../ws-share-vanilla.js', import.meta.url), 'utf8');
    const browser = {WebSocket: SimulatedWebSocket};
    runInNewContext(source, browser, {filename: 'ws-share-vanilla.js'});
    assert.equal(typeof browser.WS, 'function');
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
});

test('native Node WebSocket: local upgrade, MessageEvent delivery, sharing, and clean close', {timeout: 10000}, async function (context) {
    globalThis.WebSocket = nativeWebSocket;
    const connections = new Set();
    const server = createServer();
    context.after(async function closeLocalFixture() {
        for (const connection of connections) {
            connection.destroy();
        }
        await new Promise(function stopServer(resolve, reject) {
            server.close(function serverClosed(error) { error ? reject(error) : resolve(); });
        });
    });
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
            transport.end(Buffer.from([0x88, 0x02, 0x03, 0xe8]));
        });
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const uri = `ws://127.0.0.1:${server.address().port}/native`;
    const socket = new WS(uri);
    assert.ok(socket instanceof nativeWebSocket);
    assert.strictEqual(new WS(uri), socket);
    const message = new Promise(function receiveGreeting(resolve, reject) {
        socket.on('message', resolve, {once: true});
        socket.on('error', function connectionFailed(event) { reject(event.error ?? new Error(event.message)); }, {once: true});
    });
    assert.equal((await message).data, 'native moon cheese');
    assert.equal(socket.readyState, nativeWebSocket.OPEN);
    assert.strictEqual(new WS(uri), socket);
    const closed = new Promise(function observeClose(resolve) { socket.on('close', resolve, {once: true}); });
    socket.close(1000);
    const closeEvent = await closed;
    assert.equal(closeEvent.code, 1000);
    assert.equal(closeEvent.wasClean, true);
    assert.equal(socket.readyState, nativeWebSocket.CLOSED);
});
