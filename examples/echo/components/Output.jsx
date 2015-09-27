var React=require('react');
var WS=require('../../../WS.js');


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
                }.bind(this)
            );
        },
        componentWillUnmount:function(){
            this.ws=null;
        },
        _change:function(e){
            console.log(this.ws);
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
