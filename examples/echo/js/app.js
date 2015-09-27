var React=require('react');
var App=require('../components/App.jsx');


window.addEventListener(
    'DOMContentLoaded',
    function(){
        React.render(
            React.createElement(
                App,
                {}
            ),
            document.querySelector('body')
        );
    }
);
