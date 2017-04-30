var utility = require('./../core/utility'),
  logger = exports.logger = utility.logger('ui'),
  devices = require('./device'),
  utility = require('./../core/utility'),
  fs = require('fs');

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

var widgets = {
  '/device/switch/insteon/dimmer': { },
  '/device/switch/insteon/onoff': { },
  '/device/sensor/ticktock': { },
  '/device/indicator/clock-widget': { priority: 1 },
  '/device/climate/weather-widget': { priority: 3 },
  '/device/climate/insteon/control': { priority: 2 }
}

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
  var https = require('https');
  var express = require("express");
  var RED = require("node-red");

  var app = express();
  var mustacheExpress = require('mustache-express');
  var server = https.createServer({ key  : fs.readFileSync(__dirname + '/../db/server.key').toString(), cert : fs.readFileSync(__dirname + '/../sandbox/server.crt').toString() }, app);
  var expressWs = require('express-ws')(app, server);

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
  app.use('/animated-climacons/', express.static('node_modules/animated-climacons/svgs/'));
  app.use('/', express.static('sandbox/tiles/'));

  app.engine('html', mustacheExpress());
  app.set('view engine', 'html');
  app.set('views', __dirname + '/../sandbox/tiles/views');
  app.disable('view cache');

  app.get('/', function (req, res) {
    res.render('index');
  });

  app.ws('/api/', function(ws, req) {
    function renderDevice(data) {
      if(widgets[data.whatami]) {
        var id = data.deviceID || data.whoami.replace('device/', '');
        var resdata = widgets[data.whatami];
        resdata.id = id;
        resdata.x = -resdata.priority || id;
        resdata.y = 0;
        resdata.name = data.name;
        resdata.status = data.status;
        resdata.info = JSON.stringify(data.info);

        app.render(data.whatami.replace(/^a-z0-9-/, '').substr(1), resdata, function(err, out) {
          var msg = {'action': 'device', 'id': id, 'html': out, 'status': data.status, 'info': data.info};
          if(!!ws && ws.readyState == 1) {
            ws.send(JSON.stringify(msg));
          }
        });
      }
    }

    ws.on('message', function(msg) {
      var msg = JSON.parse(msg);
      switch(msg.action)
      {
        case 'loadDevices':
          for(var device in devices.devices) {
            renderDevice(devices.devices[device].device);
          }
          break;
        case 'perform':
          if(!!msg.id) {
            var device = devices.id2device(msg.id);
            if(!!device) {
              device.perform(device, null, msg.method, msg.params);
            }
          }
          break;
      }
    });

    utility.broker.subscribe('beacon-egress', function(category, data) {
      if(category == '.updates') {
        renderDevice(data);
      }
    });
  });

  server.listen(8000);

  RED.start()
    .then(function () {
      disable_nodes(RED);
    });
};

