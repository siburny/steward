var utility = require('./../core/utility'),
  logger = exports.logger = utility.logger('ui'),
  devices = require('./device'),
  utility = require('./../core/utility');

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
  '/device/switch/insteon/dimmer': {
    w: 1,
    h: 1,
    icon: 'lightbulb-o'
  },
  '/device/switch/insteon/onoff': {
    w: 1,
    h: 1,
    icon: 'lightbulb-o'
  }
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
  var http = require('http');
  var express = require("express");
  var RED = require("node-red");

  var app = express();
  var expressWs = require('express-ws')(app);
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

  app.get('/', function (req, res) {
    res.render('index');
  });

  app.ws('/api/', function(ws, req) {
    function renderDevice(data) {
      if(widgets[data.whatami]) {
        var id = data.deviceID;
        var resdata = widgets[data.whatami];
        resdata.id = id;
        resdata.x = id;
        resdata.y = 0;
        resdata.name = data.name;
        resdata.status = data.status;
        resdata.info = data.info;

        app.render(data.whatami.replace(/^a-z0-9-/, '').substr(1), resdata, function(err, out) {
          var msg = {'action': 'device', 'id': id, 'html': out};
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
      }
    });

    utility.broker.subscribe('beacon-egress', function(category, data) {
      if(category == '.updates') {
        renderDevice(data);
      }
    });
  });

  app.listen(8000);

  RED.start()
    .then(function () {
      disable_nodes(RED);
    });
};

