//first require polyfills for Object.observe & assign when not present
//this is especially hand for webpack and react
require('object.observe');
require('object-assign');

var wsList={};

function wsClosed(e){
    console.warn('WS CLOSED!!!');
}

function WS(uri,protocols){
    if(!uri){
        throw('WS requires a uri to initialize');
    }
    if(!wsList[uri+protocols]){
        var newWS=null;
        if(protocols){
            newWS=new WebSocket(uri,protocols);
        }else{
            newWS=new WebSocket(uri);
        }

        newWS.addEventListener(
            'close',
            wsClosed
        );

        newWS._RETRY=false;
        newWS._RETRY_EVERY=1000;

        wsList[uri]=newWS;
    }
    var ws=wsList[uri+protocols];

    Object.defineProperties(
        this,
        {
            uri:{
                writable:false,
                enumerable:true,
                value:uri
            },
            protocols:{
                writable:false,
                enumerable:true,
                value:protocols
            },
            on:{
                writable:false,
                enumerable:true,
                value:ws.addEventListener.bind(ws)
            },
            off:{
                writable:false,
                enumerable:true,
                value:ws.removeEventListener.bind(ws)
            },
            addEventListener:{
                writable:false,
                enumerable:true,
                value:ws.addEventListener.bind(ws)
            },
            removeEventListener:{
                writable:false,
                enumerable:true,
                value:ws.removeEventListener.bind(ws)
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

module.exports=WS;
