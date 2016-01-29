'use strict';

var WebSocket=null;

if(isNode()){
    WebSocket = require('ws');
}else{
    WebSocket=window.WebSocket;
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
        }else{
            ws.addListener = ws.addEventListener;
            ws.removeListener = ws.removeEventListener;
        }

        if(newWS){
            ws.addEventListener(
                'close',
                wsClosed
            );
        }else{
            return ws;
        }

        Object.defineProperties(
            ws,
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
                    value:ws.addEventListener
                },
                off:{
                    writable:false,
                    enumerable:true,
                    value:ws.removeEventListener
                }
            }
        );

        return ws;
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
