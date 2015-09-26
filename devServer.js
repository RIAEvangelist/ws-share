var webpack = require('webpack');
var WebpackDevServer = require('webpack-dev-server');
var config = require('./webpack.config');
var example = process.argv[2];

if(!example){
    console.log('you must specify the example to start like : npm start myExample');
    return;
}
var hotConfig={
    uiPort:8080,
    hotPort:3000,
    host:'0.0.0.0',
    acceptOnHost:'0.0.0.0',
    path:'/js/'
}

config.output.path+=hotConfig.path.slice(1);
config.output.publicPath=hotConfig.path;
config.entry[0]+=example+hotConfig.path+'app.js';
config.entry.unshift('webpack/hot/only-dev-server');
config.entry.unshift('webpack-dev-server/client?http://'
    +hotConfig.acceptOnHost+':'
    +hotConfig.uiPort
);
config.plugins.unshift(new webpack.HotModuleReplacementPlugin());

for(var loader in config.module.loaders){
    config.module.loaders[loader].loaders.unshift('react-hot');
}

config.devServer.contentBase+=example;

var server=new WebpackDevServer(
    webpack(config),
    {
        publicPath: config.output.publicPath,
        hot: true,
        historyApiFallback: true
    }
);

server.use(
    '/',
    function(req, res) {
        res.sendFile(
            __dirname+'/examples/'+example+req.url
        );
    }
);

server.listen(
    hotConfig.uiPort,
    hotConfig.host,
    function (err, result) {
        if (err) {
            console.log(err);
        }

        console.log('Serving at : '+config.output.publicPath);
    }
);
