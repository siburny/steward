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

  var settings = {
    httpAdminRoot: '/red/',
    httpNodeRoot: '/api/',
    userDir: './db/node-red/',
    functionGlobalContext: {}
  };

  RED.init(server, settings);
  RED.init(serverSecure, settings);

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

  app.engine('html', mustacheExpress());
  app.set('view engine', 'html');
  app.set('views', __dirname + '/../sandbox/tiles/views');
  app.disable('view cache');

  app.get('/', function (req, res) {
    res.render('index');
  });

  app.get('/cloud/endpoint', function (req, res) {
    res.json({ 'index': 'ok' });
  });

  app.ws('/api/', function (ws, req) {
    function renderDevice(data) {
      if (widgets[data.whatami]) {
        var id = data.deviceID || data.whoami.replace('device/', '');
        var resdata = widgets[data.whatami];
        resdata.id = id;
        resdata.x = -resdata.priority || id;
        resdata.y = 0;
        resdata.name = data.name;
        resdata.status = data.status;
        resdata.info = JSON.stringify(data.info);

        app.render(data.whatami.replace(/^a-z0-9-/, '').substr(1), resdata, function (err, out) {
          var msg = { 'action': 'device', 'id': id, 'html': out, 'status': data.status, 'info': data.info };
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
          for (var device in devices.devices) {
            renderDevice(devices.devices[device].device);
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

    ws.on('close', function() {

    });

    utility.broker.subscribe('beacon-egress', function (category, data) {
      console.log(data);
      if (category == '.updates') {
        renderDevice(data);
      }
    });
  });

  app.get('/cloud/auth', function (req, res) {
    let client_id = req.query.client_id;
    let redirect_uri = req.query.redirect_uri;
    let state = req.query.state;
    let response_type = req.query.response_type;
    let authCode = req.query.code;

    if ('code' != response_type)
      return res.error('response_type ' + response_type + ' must equal "code"');

    if (client_id !== 'RKkWfsi0Z9')
      return res.error('client_id ' + client_id + ' invalid');

    // if you have an authcode use that
    if (authCode) {
      return res.redirect(util.format('%s?code=%s&state=%s',
        redirect_uri, authCode, state
      ));
    }

    let user = false;
    // Redirect anonymous users to login page.
    if (!user) {
      return res.redirect(util.format('/login?client_id=%s&redirect_uri=%s&redirect=%s&state=%s',
        client_id, encodeURIComponent(redirect_uri), req.path, state));
    }

    console.log('login successful ', user.name);
    authCode = SmartHomeModel.generateAuthCode(user.uid, client_id);

    if (authCode) {
      console.log('authCode successful ', authCode);
      return res.redirect(util.format('%s?code=%s&state=%s',
        redirect_uri, authCode, state));
    }

    return res.status(400).send('something went wrong');

  });

  app.all('/cloud/token', function (req, res) {
    console.log('/token query', req.query);
    console.log('/token body', req.body);
    let client_id = req.query.client_id ? req.query.client_id : req.body.client_id;
    let client_secret = req.query.client_secret ? req.query.client_secret : req.body.client_secret;
    let grant_type = req.query.grant_type ? req.query.grant_type : req.body.grant_type;

    if (!client_id || !client_secret) {
      console.error('missing required parameter');
      return res.status(400).send('missing required parameter');
    }

    // if ('token' != req.query.response_type) {
    //     console.error('response_type ' + req.query.response_type + ' is not supported');
    //     return res.status(400).send('response_type ' + req.query.response_type + ' is not supported');
    // }

    /*let client = SmartHomeModel.getClient(client_id, client_secret);
    console.log('client', client);
    if (!client) {
      console.error('incorrect client data');
      return res.status(400).send('incorrect client data');
    }

    if ('authorization_code' == grant_type)
      return handleAuthCode(req, res);
    else if ('refresh_token' == grant_type)
      return handleRefreshToken(req, res);
    else {
      console.error('grant_type ' + grant_type + ' is not supported');
      return res.status(400).send('grant_type ' + grant_type + ' is not supported');
    }*/
  });


  // Get login.
  app.get('/login', function (req, res) {
    res.render('login', {
      redirect: encodeURIComponent(req.query.redirect),
      client_id: req.query.client_id,
      state: req.query.state,
      redirect_uri: encodeURIComponent(req.query.redirect_uri)
    })
  });

  // Post login.
  app.post('/login', function (req, res) {
    console.log('/login ', req.body);
    let user = true;
    if (!user) {
      console.log('not a user', user);
      return login(req, res);
    }

    console.log('logging in ', user);

    // Successful logins should send the user back to /oauth/.
    let path = decodeURIComponent(req.body.redirect) || '/frontend';

    console.log('login successful');
    let authCode = 'kjfsldkfjaslkjdfnaslkfa';

    if (authCode) {
      console.log('authCode successful ', authCode);
      return res.redirect(util.format('%s?code=%s&state=%s',
        decodeURIComponent(req.body.redirect_uri), authCode, req.body.state));
    } else {
      console.log('authCode failed');
      return res.redirect(util.format('%s?client_id=%s&redirect_uri=%s&state=%s&response_type=code',
        path, req.body.client_id, req.body.redirect_uri, req.body.state));
    }
  });

  RED.start()
    .then(function () {
      disable_nodes(RED);
    });
};

