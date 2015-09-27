var React=require('react');
var WS=require('../../../WS.js');

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
