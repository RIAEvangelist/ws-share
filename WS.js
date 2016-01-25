'use strict';

if(isNode()){
    WebSocket = require('ws');
}

const wsList={};

function wsClosed(e){
    delete wsList[this._WS_KEY];
}

class WS{
    constructor(uri,protocols){
        if(!uri){
            throw('WS requires a uri to initialize');
        }
        let newWS=null;
        if(!wsList[uri+protocols]){

            if(protocols){
                newWS=new WebSocket(uri,protocols);
            }else{

                newWS=new WebSocket(uri);
            }

            newWS._WS_KEY=uri+protocols;
            wsList[uri+protocols]=newWS;
        }
        const ws=wsList[uri+protocols];

        if(isNode()){
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
}

function isNode() {
    let isNode = true;
    try {
        isNode = ( Window ) ? false : true;
    } catch ( err ) {
        //not the browser
    }
    return isNode;
}

module.exports=WS;
