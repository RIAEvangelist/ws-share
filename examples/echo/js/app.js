import WS from '../../../WS.js';

const connectForm = document.querySelector('#connect-form');
const sendForm = document.querySelector('#send-form');
const uri = document.querySelector('#uri');
const message = document.querySelector('#message');
const status = document.querySelector('#status');
const output = document.querySelector('#output');
const send = document.querySelector('#send');
const disconnect = document.querySelector('#disconnect');
let sender;
let receiver;

connectForm.addEventListener('submit', connect);
sendForm.addEventListener('submit', sendMessage);
disconnect.addEventListener('click', closeConnection);

function connect(event) {
    event.preventDefault();
    if (sender) {
        receiver.off('message', receiveMessage);
        sender.off('open', connected);
        sender.off('close', closed);
        sender.off('error', failed);
        sender.close();
    }

    send.disabled = true;
    disconnect.disabled = true;
    status.textContent = 'Connecting…';
    try {
        sender = new WS(uri.value);
        receiver = new WS(uri.value);
        receiver.on('message', receiveMessage);
        sender.on('open', connected);
        sender.on('close', closed);
        sender.on('error', failed);
        disconnect.disabled = false;
        if (sender.readyState === WebSocket.OPEN) {
            connected();
        }
    } catch (error) {
        status.textContent = `Could not connect: ${error.message}`;
    }
}

function connected() {
    status.textContent = `Connected. Sender and receiver share one socket: ${sender === receiver}.`;
    send.disabled = false;
}

function closed() {
    status.textContent = 'Connection closed.';
    send.disabled = true;
    disconnect.disabled = true;
}

function failed() {
    status.textContent = 'Connection failed. Check the server URL and reconnect.';
    send.disabled = true;
}

function sendMessage(event) {
    event.preventDefault();
    if (sender?.readyState !== WebSocket.OPEN) {
        status.textContent = 'Connect before sending a message.';
        return;
    }
    sender.send(message.value);
}

function receiveMessage(event) {
    output.append(`${event.data}\n`);
}

function closeConnection() {
    sender.close();
}
