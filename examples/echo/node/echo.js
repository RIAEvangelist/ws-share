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
