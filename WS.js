//first require polyfills for Object.observe & assign when not present
//this is especially hand for webpack and react
if(isNode){
    WebSocket = require('ws');
}

var wsList={};

function wsClosed(e){
    delete wsList[this._WS_KEY];
}

function WS(uri,protocols){
    if(!uri){
        throw('WS requires a uri to initialize');
    }
    var newWS=null;
    if(!wsList[uri+protocols]){


        if(protocols){
            newWS=new WebSocket(uri,protocols);
        }else{

            newWS=new WebSocket(uri);
        }

        newWS._WS_KEY=uri+protocols;

        wsList[uri+protocols]=newWS;
    }
    var ws=wsList[uri+protocols];

    if(isNode){
        ws.addEventListener = ws.addListener;
        ws.removeEventListener = ws.removeListener;
    }

    if(newWS){
        ws.addEventListener(
            'close',
            wsClosed
        );
    }

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
            toObject:{
                get:getAsObject,
                set:getAsObject
            }
        }
    );

    function getReadyState(){
        return ws.readyState;
    }

    function getAsObject(){
        return Object.assign(
            {},
            this
        );
    }
}

function isNode(){
    try {
        return this === global;
    }catch(err)
    {
        return false;
    }
}

module.exports=WS;
