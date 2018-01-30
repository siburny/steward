var utility = require('./../core/utility'),
  logger = exports.logger = utility.logger('ui'),
  devices = require('./device'),
  utility = require('./../core/utility'),
  fs = require('fs'),
  util = require('util'),
  bodyParser = require('body-parser');

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
  '/device/gateway/insteon/usb': {},
  '/device/switch/insteon/dimmer': {},
  '/device/switch/insteon/onoff': {},
  '/device/sensor/ticktock': {},
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

exports.start = function (server, serverSecure, app) {
  var RED = require("node-red");
  var mustacheExpress = require('mustache-express');
  var express = require("express");
  var session = require('express-session');

  var settings = {
    httpAdminRoot: '/red/',
    httpNodeRoot: '/api/',
    userDir: './db/node-red/',
    functionGlobalContext: {}
  };

  RED.init(server, settings);
  if (!!serverSecure) {
    RED.init(serverSecure, settings);
  }

  app.use(settings.httpAdminRoot, RED.httpAdmin);
  app.use(settings.httpNodeRoot, RED.httpNode);

  app.use('/modules/jquery/', express.static('node_modules/jquery/dist/'));
  app.use('/modules/jquery-ui/', express.static('node_modules/jquery-ui-bundle/'));
  app.use('/modules/materialize/', express.static('node_modules/materialize-css/dist'));
  app.use('/modules/font-awesome/', express.static('node_modules/font-awesome'));
  app.use('/modules/material-design-icons/', express.static('node_modules/material-design-icons-iconfont/dist'));
  app.use('/modules/grid-list/', express.static('node_modules/grid-list/src/'));
  app.use('/modules/animated-climacons/', express.static('node_modules/animated-climacons/svgs/'));
  app.use('/modules/jquery-taphold/', express.static('node_modules/jquery-taphold/'));
  app.use('/', express.static('sandbox/tiles/'));

  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(require('res-error'));

  app.use(session({ secret: require('crypto').randomBytes(32).toString(), resave: false, saveUninitialized: false }));

  app.engine('html', mustacheExpress());
  app.set('view engine', 'html');
  app.set('views', __dirname + '/../sandbox/tiles/views');
  app.disable('view cache');

  app.get('/', function (req, res) {
    res.render('index');
  });

  app.ws('/api/', function (ws, req) {
    function renderDevice(data) {
      if (!!data && widgets[data.whatami]) {
        var id = data.deviceID || data.whoami.replace('device/', '');
        var resdata = widgets[data.whatami];
        resdata.id = id;
        resdata.x = -resdata.priority || id;
        resdata.y = 0;
        resdata.name = data.name;
        resdata.nickname = data.nickname;
        resdata.status = data.status;
        resdata.info = JSON.stringify(data.info);

        app.render(data.whatami.replace(/^a-z0-9-/, '').substr(1), resdata, function (err, out) {
          var msg = { 'action': 'device', 'id': id, 'html': out, 'status': data.status, 'info': data.info, 'name': data.name, 'nickname': data.nickname, 'room': data.room };
          if (!!ws && ws.readyState == 1) {
            ws.send(JSON.stringify(msg));
          }
        });
      }
    }

    ws.on('message', function (msg) {
      var msg = JSON.parse(msg);
      switch (msg.action) {
        case 'loadDevices':
          let rooms = [];
          for (var device in devices.devices) {
            if (!!devices.devices[device].device) {
              renderDevice(devices.devices[device].device);
              if (devices.devices[device].device.hasOwnProperty('room')) {
                rooms.push(devices.devices[device].device.room);
              }
              ws.send(JSON.stringify({ 'action': 'room', 'rooms': rooms }));
            }
          }
          break;

        case 'perform':
          if (!!msg.id) {
            var device = devices.id2device(msg.id);
            if (!!device) {
              device.perform(device, null, msg.method, msg.params);
            }
          }
          break;
      }
    });

    var listener = function (category, data) {
      if (category == '.updates') {
        renderDevice(data);
      }
    }

    utility.broker.on('beacon-egress', listener);
    ws.on('close', function () {
      utility.broker.off('beacon-egress', listener);
    });
  });

  RED.start()
    .then(function () {
      disable_nodes(RED);
    });
};
