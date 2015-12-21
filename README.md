# ws-share
A module allowing sharing of websockets between different functions, modules, scripts, actions, stores, and/or components with vanilla js (plain js), react, webpack or browserify. ***This module is brand new, don't hold its lack of stats and install against it, give it a shot!***

npm ws-share info :  [See npm trends and stats for ws-share](http://npm-stat.com/charts.html?package=ws-share&author=&from=&to=)  
![ws-share npm version](https://img.shields.io/npm/v/ws-share.svg) ![supported node version for ws-share](https://img.shields.io/node/v/ws-share.svg) ![total npm downloads for ws-share](https://img.shields.io/npm/dt/ws-share.svg) ![monthly npm downloads for ws-share](https://img.shields.io/npm/dm/ws-share.svg) ![npm licence for ws-share](https://img.shields.io/npm/l/ws-share.svg)

` npm install --save ws-share `  

[![RIAEvangelist](https://avatars3.githubusercontent.com/u/369041?v=3&s=100)](https://github.com/RIAEvangelist)

GitHub info :  
[![ws-share GitHub Release](https://img.shields.io/github/release/RIAEvangelist/ws-share.svg) ![GitHub license ws-share license](https://img.shields.io/github/license/RIAEvangelist/ws-share.svg) ![open issues for ws-share on GitHub](https://img.shields.io/github/issues/RIAEvangelist/ws-share.svg)](http://riaevangelist.github.io/ws-share/)

[ws-share site](http://riaevangelist.github.io/ws-share/)

## What does ws-share do?
ws-share managaes a list of open websockets and protocols allowing websockets to be easily shared between multiple vanilla js (plain js), or common js modules. Each module can create a new WS instance for a given uri and protocol. However, if a socket with that uri & protocol list has already been opened, WS will refrence the open socket instead of creating a new socket for the same uri and protocol list.

ws-share is designed to feel like you are naturally working with a standard WebSocket

## Tips
For vanilla js (just plain old js) include the browser.js file

    <script src='ws-share-vanilla.js' />

You should check ws.readyState upon creation.  

***Why?***  

If the websocket was already opened  `ws.on('open',callback)` wont be called. So checking the ready state will allow you to perform any initialization needed in your component, action or store.

|method or value    |type   |mutable|description|
|-------------------|-------|-------|-----------|
|uri                |string |false  |the uri of the shared ws|
|protocols          |array/string|false  |the protocols of the shared ws|
|on                 |func   |false  |bind event listener to shared websocket|
|off                |func   |false  |UNbind event listener to shared websocket|
|addEventListener   |func   |false  |bind event listener to shared websocket|
|removeEventListener|func   |false  |UNbind event listener to shared websocket|
|send               |func   |false  |Send data to server|
|readyState         |number |not by user|The current readyState of the shared websocket|
|toObject           |func   |false  |returns an object representation of an instantiated version of this class|


## Contributing

1. Pull or Fork code.
2. from the cloned directory run ` npm install ` (this will install required dependancies, depending on your system may require)
3. be awesome!

## Running Example React Shared WebSocket Echo App
This very basic react.js example app has two components share the same websocket. Neither is aware they are sharing though. The Input component sends info upto the server while the Output listens for messages from the server. The [websocket.org](https://websocket.org/) server here just echo's all information back for demo purposes.

1. ` npm install `
2. ` npm start echo `
3. goto [localhost:8080](http://localhost:8080)
4. type some stuff and watch both components use the same websocket


## Create or Use Existing Shared WebSocket
This follows the [standard WebSocket interface](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_client_applications).  

```javascript  

    //commonjs
    var WS=require('ws-share');
    //or vanilla js
    <script src='ws-share-vanilla.js' />


    var basicWS=new WS('wss://echo.websocket.org/?encoding=text');

    var wsWithOneProtocol=new WS('wss://echo.websocket.org/?encoding=text','stream');

    var wsWithManyProtocols=new WS(
        'wss://echo.websocket.org/?encoding=text',
        [
            'stream',
            'chat',
            'whatever'
        ]
    );

```


## Bind Events on a Shared WebSocket
This follows the [standard WebSocket interface](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_client_applications) and also extends that interface with ` .on ` and ` .off ` as shortcuts for ` .addEventListener ` and ` .removeEventListener ` as on/off is commonly used in node applications and may be more intuitive for some developers.  All standard events are supported. ***Remember the scope of your callback is the shared websocket! if you want to use the react modules scope use*** ` .bind(this) ` ***on the callback***

```javascript  

    //commonjs
    var WS=require('ws-share');
    //or vanilla js
    <script src='ws-share-vanilla.js' />

    var ws=new WS('wss://echo.websocket.org/?encoding=text');

    ws.on(
        'open',
        function(e){
            console.log('shared websocket open!');
        }
    )

    ws.on(
        'close',
        function(e){
            console.log('shared websocket closed!');
        }
    )

    ws.on(
        'error',
        function(e){
            console.log('OMG there\'s been an error!',e);
        }
    )

    ws.on(
        'message',
        function(e){
            console.log('got message on shared ws!',e.data);
        }
    )


```

## Basic Example :
You will notice this looks just like a standard websocket creation, but behind the scenes it stores a refrence to share with any other component, store, or action which may also need access to this same websocket.  

```javascript  

    //commonjs
    var WS=require('ws-share');
    //or vanilla js
    <script src='ws-share-vanilla.js' />

    var ws=new WS('wss://echo.websocket.org/?encoding=text');
    ws.on(
        'message',
        function(e){
            console.log(e.data);
        }
    );

```
## Basic Node Example :

```javascript

    var WS=require('ws-share');

    var ws=new WS('wss://echo.websocket.org/?encoding=text');

    ws.on(
       'open',
       function(){
           ws.send('hello world!');
       }
    );

    ws.on(
        'message',
        function (message){
            console.log(message);
        }
    );

    ws.on(
        'error',
        function (err){
            console.log('error encountered :', err);
        }
    );

```

## Basic React Send Example :
You will notice this looks just like a standard websocket creation, but behind the scenes it stores a refrence to share with any other component, store, or action which may also need access to this same websocket. For example, the next example, Output would share this same ws without needing a different format.

```javascript  

    var React=require('react');
    var WS=require('ws-share');

    var Input=React.createClass(
        {
            componentWillMount:function(){
                this.ws=new WS('wss://echo.websocket.org/?encoding=text');
            },
            componentWillUnmount:function(){
                this.ws=null;
            },
            _change:function(e){
                if(this.ws.readyState!==1){
                    console.log('WS not yet connected or already disconnected. Can not send message.');
                    return;
                }
                this.ws.send(e.target.value);
            },
            render:function(){
                return (
                    <div>
                        <h3>
                            Send To Server
                        </h3>
                        <input onChange={this._change} />
                    </div>
                )
            }
        }
    );

    module.exports=Input;

```

## Basic React Listen for Message Example :
You will notice this looks just like a standard websocket creation, but behind the scenes it stores a refrence to share with any other component, store, or action which may also need access to this same websocket. For example, the previous example, Input would share this same ws without needing a different format.

```javascript  

    var React=require('react');
    var WS=require('ws-share');

    var Output=React.createClass(
        {
            getInitialState:function(){
                return {
                    message:''
                }
            },
            componentWillMount:function(){
                this.ws=new WS('wss://echo.websocket.org/?encoding=text');
                this.ws.on(
                    'message',
                    function(e){
                        this.setState(
                            {
                                message:e.data
                            }
                        )
                    //We want to use this.state,
                    //so we have to bind the react component
                    //scope to the callback
                    }.bind(this)
                );
            },
            componentWillUnmount:function(){
                this.ws=null;
            },
            _change:function(e){
                if(this.ws.readyState!==1){
                    console.log('WS not yet connected or already disconnected. Can not send message.');
                    return;
                }
                this.ws.send(e.target.value);
            },
            render:function(){
                return (
                    <div>
                        <h3>
                            Got From Server
                        </h3>
                        <textarea value={this.state.message} />
                    </div>
                )
            }
        }
    );

    module.exports=Output;


```

---

This work is licenced via the [DBAD Public Licence](http://www.dbad-license.org/).
