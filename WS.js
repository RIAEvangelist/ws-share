//first require polyfills for Object.observe & assign when not present
//this is especially hand for webpack and react
require('object.observe');
require('object-assign');
var events=require('event-pubsub');

var wsList={};

function wsOpened(e){
    //events.trigger();
    console.warn('WS OPENED!!!');
}

function wsClosed(e){
    //events.trigger();
    console.warn('WS CLOSED!!!');
}

function wsMessage(e){
    //events.trigger();
    console.log('ws got message : '+e.data);
}

function readyStateChanged(){

}

function WS(uri,protocols){
    if(!uri){
        throw('WS requires a uri to initialize');
    }
    if(!wsList[uri]){
        var newWS=new WebSocket(uri,protocols||null)//"wss://dev1.2-sight.com:32802"

        newWS.addEventListener(
            'open',
            wsOpened
        );

        newWS.addEventListener(
            'close',
            wsClosed
        );

        newWS.addEventListener(
            'message',
            wsMessage
        );

        Object.observe(
            newWS.readyState,
            readyStateChanged
        );

        newWS._RETRY=true;
        newWS._RETRY_EVERY=true;

        wsList.push(
            newWS
        );
    }
    var ws=wsList[uri];

    Object.defineProperties(
        this,
        {
            uri:{
                writable:false,
                enumerable:true,
                value:uri
            },
            on:{
                writable:false,
                enumerable:true,
                value:events.on.bind(events)
            },
            off:{
                writable:false,
                enumerable:true,
                value:events.off.bind(events)
            },
            send:{
                writable:false,
                enumerable:true,
                value:ws.send.bind(ws)
            },
            readyState:{
                get:getReadyState,
                set:getReadyState
            },
            shouldRetry:{
                get:getShouldRetry,
                set:setShouldRetry
            },
            retryEvery:{
                get:getRetryEvery,
                set:setRetryEvery
            },
            toObject:{
                get:getAsObject,
                set:getAsObject
            }
        }
    );

    function getShouldRetry(){
        return ws._RETRY;
    }
    function setShouldRetry(value){
        return ws._RETRY=value;
    }


    function getRetryEvery(){
        return ws._RETRY_EVERY;
    }
    function setRetryEvery(ms){
        return ws._RETRY_EVERY=ms;
    }

    function getReadyState(){
        return ws.readyState;
    }

    function getAsObject(){
        return Object.assign(
            {},
            this
        );
    }

    function getReadyState(){
        return ws.readyState;
    }

}

module.exports.WS;
