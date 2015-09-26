var basePath=__dirname+'/examples/';

var config={
    entry: [
        basePath
    ],
    output: {
        path:basePath,
        filename: 'bundle.js'
    },
    module: {
        loaders: [
            {
                test: /\.jsx$/,
                loaders: ['jsx-loader']
            },
            {
                test:/\.css/,
                loaders: [
                    'style-loader',
                    'css-loader'
                ]
            }
        ]
    },
    plugins:[],
    externals: {

    },
    resolve: {
        extensions: ['', '.js', '.jsx'],
        modulesDirectories: ['node_modules'],
    },
    devServer: {
        contentBase: basePath
    }
}

module.exports=config;
