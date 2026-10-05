import WS from '../../../WS.js';

const uri = process.argv[2];
if (!uri) {
    throw new TypeError('Pass your echo server URL: node examples/echo/node/echo.js ws://localhost:8081');
}

const sender = new WS(uri);
const receiver = new WS(uri);
console.log('Same shared socket:', sender === receiver);

sender.on(
    'open',
    function orderCoffee() {
        sender.send('One espresso. Low gravity. Extra lid.');
    },
    {once: true}
);

receiver.on(
    'message',
    function receiveOrder(event) {
        console.log(event.data);
        receiver.close();
    },
    {once: true}
);

receiver.on(
    'error',
    function reportError(event) {
        console.error('WebSocket connection failed.', event);
        process.exitCode = 1;
    }
);
