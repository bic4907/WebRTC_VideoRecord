'use strict';

const bodyParser = require('body-parser');
const browserify = require('browserify-middleware');
const express = require('express');
const fs = require('fs');
const { join } = require('path');

const { mount } = require('./lib/server/rest/connectionsapi');
const WebRtcConnectionManager = require('./lib/server/connections/webrtcconnectionmanager');

const app = express();

app.use(bodyParser.json());


let path = __dirname
function makeDirectory(name) {
    let dir = __dirname + '/' + name;
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
}
makeDirectory('tmp')
makeDirectory('videos')
makeDirectory('logs')

function setupPage() {

    app.use(`/index.js`, browserify(join(__dirname, 'client.js')));
    app.get(`/`, (req, res) => {
        res.sendFile(join(__dirname, 'pages', 'index.html'));
    });

    const options = require(join(__dirname, 'server.js'));
    const connectionManager = WebRtcConnectionManager.create(options);
    mount(app, connectionManager, '');

    return connectionManager;
}

let connectionManager = setupPage();

const server = app.listen(3000, () => {
    const address = server.address();
    console.info(`Server running @ http://localhost:${address.port}\n`);

    server.once('close', () => {
        connectionManager.close();
    });
});
