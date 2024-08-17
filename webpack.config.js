
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');


module.exports = {
    entry: './src/index.js',

    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist'),
        clean: true,
    },

    module: {
        rules: [
            {
                test: /\.css$/i,
                use: ['style-loader', 'css-loader'],
            },
            {
                test: /\.(png|svg|jpg|jpeg|gif)$/i,
                type: 'asset/resource',
            },
            {
                test: /\.(woff|woff2|eot|ttf|otf)$/i,
                type: 'asset/resource',
            },
        ],
    },

    plugins: [
        new HtmlWebpackPlugin({
            template: './src/layout/index.html',
        }),
    ],

    devtool: 'cheap-module-source-map',

    devServer: {
        static: {
            directory: path.resolve(__dirname),
            watch: true,
        },
        compress: true,
        port: 9000,
        open: true,
    },
};
