
var React=require('react');
var Input=require('../components/Input.jsx');
var Output=require('../components/Output.jsx');

var App=React.createClass(
    {
        render:function(){
            return (
                <div>
                    <Input/>
                    <Output/>
                </div>
            )
        }
    }
);

module.exports=App;
