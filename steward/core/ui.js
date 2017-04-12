var utility = require('./../core/utility');


var logger = exports.logger = utility.logger('ui');

var nodes_blacklist = [
  "node-red/sentiment",
  "node-red/CSV",
  "node-red/HTML",
  "node-red/JSON",
  "node-red/XML",
  "node-red/tail",
  "node-red/file",
  "node-red-node-feedparser/feedparse",
  "node-red-node-serialport/serialport",
  "node-red-node-twitter/twitter",
  "node-red/tcpin",
  "node-red/udp",
  "node-red/websocket",
  "node-red/httpin",
  "node-red/httprequest",
  "node-red/mqtt",
  "node-red/tls",
  "node-red/rpi-gpio",
  "node-red/unknown"
]

function disable_nodes(RED) {
  if (RED.nodes.getFlows() == null) {
    setTimeout(function () {
      disable_nodes(RED);
    }, 100);
    return;
  }

  var nodes = RED.nodes.getNodeList();
  for (i = 0; i < nodes.length; i++) {
    if (nodes_blacklist.indexOf(nodes[i].id) !== -1) {
      RED.nodes.disableNode(nodes[i].id);
    } else {
      RED.nodes.enableNode(nodes[i].id);
    }
  }
}

exports.start = function () {
  var http = require('http');
  var express = require("express");
  var RED = require("node-red");

  var app = express();
  var mustacheExpress = require('mustache-express');
  var server = http.createServer(app);

  var settings = {
    httpAdminRoot: '/red/',
    httpNodeRoot: '/api/',
    userDir: './db/node-red/',
    functionGlobalContext: {}
  };

  RED.init(server, settings);

  app.use(settings.httpAdminRoot, RED.httpAdmin);
  app.use(settings.httpNodeRoot, RED.httpNode);

  app.use('/jquery/', express.static('node_modules/jquery/dist/'));
  app.use('/jquery-ui/', express.static('node_modules/jquery-ui-bundle/'));
  app.use('/materialize/', express.static('node_modules/materialize-css/dist'));
  app.use('/font-awesome/', express.static('node_modules/font-awesome'));
  app.use('/material-design-icons/', express.static('node_modules/material-design-icons-iconfont/dist'));
  app.use('/grid-list/', express.static('node_modules/grid-list/src/'));
  app.use('/', express.static('sandbox/tiles/'));

  app.engine('html', mustacheExpress());
  app.set('view engine', 'html');
  app.set('views', __dirname + '/../sandbox/tiles/views');
  app.disable('view cache');

  var devices = [];
  devices.push({id: 01, status: 'off', w: 1, h: 1, x:01, y:0});
  devices.push({id: 02, status: 'off', w: 1, h: 1, x:02, y:0});
  devices.push({id: 03, status: 'on' , w: 1, h: 1, x:03, y:0});
  devices.push({id: 04, status: 'off', w: 2, h: 2, x:04, y:0});
  devices.push({id: 05, status: 'off', w: 1, h: 1, x:05, y:0});
  devices.push({id: 06, status: 'off', w: 1, h: 1, x:06, y:0});
  devices.push({id: 07, status: 'off', w: 1, h: 1, x:07, y:0});
  devices.push({id: 08, status: 'on ', w: 2, h: 1, x:08, y:0});
  devices.push({id: 09, status: 'off', w: 1, h: 1, x:09, y:0});
  devices.push({id: 10, status: 'off', w: 1, h: 1, x:10, y:0});
  devices.push({id: 11, status: 'off', w: 1, h: 1, x:11, y:0});
  devices.push({id: 12, status: 'off', w: 2, h: 1, x:12, y:0});
  devices.push({id: 13, status: 'off', w: 1, h: 1, x:13, y:0});
  devices.push({id: 14, status: 'on ', w: 1, h: 1, x:14, y:0});
  devices.push({id: 15, status: 'off', w: 1, h: 1, x:15, y:0});
  devices.push({id: 16, status: 'off', w: 1, h: 1, x:16, y:0});
  devices.push({id: 17, status: 'off', w: 1, h: 1, x:17, y:0});
  devices.push({id: 18, status: 'on ', w: 1, h: 1, x:18, y:0});

  app.get('/', function (req, res) {
    res.render('index', {devices: devices});
  });

  server.listen(8000);

  RED.start()
    .then(function () {
      disable_nodes(RED);
    });
};

