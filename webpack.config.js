const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CompressionPlugin = require('compression-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const ESLintPlugin = require('eslint-webpack-plugin');

module.exports = (_env, argv) => {
    const isProduction = argv.mode === 'production';
    const isDevelopment = !isProduction;

    return {
        entry: './src/index.ts',

        output: {
            filename: isProduction ? '[name].[contenthash].js' : 'bundle.js',
            path: path.resolve(__dirname, 'dist'),
            clean: true,
            assetModuleFilename: 'assets/[name].[contenthash][ext]',
        },

        resolve: {
            extensions: ['.ts', '.js'],
        },

        cache: isProduction
            ? {
                  type: 'filesystem',
                  buildDependencies: {
                      config: [__filename],
                  },
              }
            : false,

        optimization: {
            minimize: isProduction,
            minimizer: [
                new TerserPlugin({
                    terserOptions: {
                        compress: {
                            drop_console: false,
                        },
                        mangle: false,
                    },
                }),
                new CssMinimizerPlugin(),
            ],
            splitChunks: isProduction
                ? {
                      chunks: 'all',
                      cacheGroups: {
                          vendor: {
                              test: /[\\/]node_modules[\\/]/,
                              name: 'vendors',
                              priority: 10,
                          },
                          common: {
                              minChunks: 2,
                              priority: 5,
                              reuseExistingChunk: true,
                          },
                      },
                  }
                : false,
            runtimeChunk: isProduction ? 'single' : false,
        },

        module: {
            rules: [
                {
                    test: /\.ts$/,
                    use: 'ts-loader',
                    exclude: /node_modules/,
                },
                {
                    test: /\.css$/i,
                    use: [isProduction ? MiniCssExtractPlugin.loader : 'style-loader', 'css-loader'],
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
                favicon: './src/assets/favicon.ico',
                minify: isProduction
                    ? {
                          removeComments: true,
                          collapseWhitespace: true,
                          removeAttributeQuotes: true,
                      }
                    : false,
            }),
            new ESLintPlugin({
                extensions: ['ts'],
                configType: 'flat',
                cache: true,
                cacheLocation: 'node_modules/.cache/eslint-webpack-plugin/.eslintcache',
                lintDirtyModulesOnly: true,
                failOnError: isProduction,
                failOnWarning: false,
                emitWarning: true,
            }),
            isProduction &&
                new MiniCssExtractPlugin({
                    filename: '[name].[contenthash].css',
                }),
            isProduction &&
                new CompressionPlugin({
                    algorithm: 'gzip',
                    test: /\.(js|css|html|svg)$/,
                    threshold: 10240,
                    minRatio: 0.8,
                }),
            process.env.ANALYZE &&
                new BundleAnalyzerPlugin({
                    analyzerMode: 'static',
                    openAnalyzer: false,
                    reportFilename: 'bundle-report.html',
                }),
        ].filter(Boolean),

        devtool: isDevelopment ? 'cheap-module-source-map' : 'source-map',

        devServer: {
            static: {
                directory: path.resolve(__dirname),
                watch: true,
            },
            compress: true,
            port: 9000,
            open: true,
            hot: true,
        },

        performance: {
            hints: isProduction ? 'warning' : false,
            maxEntrypointSize: 512000,
            maxAssetSize: 512000,
        },
    };
};
