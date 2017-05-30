var fs = require('fs')
  , http = require('http')
  , https = require('https')
  //, mime        = require('mime')
  , mqtt = require('mqtt')
  , net = require('net')
  , os = require('os')
  , portscanner = require('portscanner')
  , speakeasy = require('speakeasy')
  //, ssh_keygen  = require('ssh-keygen')
  , static = require('node-static')
  //, tls         = require('tls')
  , url = require('url')
  , util = require('util')
  , x509keygen = require('x509-keygen')
  , winston = require('winston')
  , wsServer = require('ws').Server
  , steward = require('./steward')
  , utility = require('./utility')
  , broker = utility.broker
  ;


var logger = utility.logger('server');

try {
  if ((process.arch !== 'arm') || (process.platform !== 'linux')) {
    var mdns = require('mdns');
  } else {
    var avahi = require('avahi_pub');

    if (!avahi.isSupported()) {
      logger.info('failing Avahi publisher (continuing)');
      avahi = null;
    }
  }
} catch (ex) { }


var places = null;
var routes = exports.routes = {};


exports.start = function () {
  var port = 8887,
    portSecure = 8888;
  checkPorts(port, portSecure)
    .then(function (status) {
      if (status === 'open') {
        logger.error('server', { event: 'not starting the server, ports are not available' });
      } else {
        start(port, portSecure);
      }
    });

  utility.acquire(logger, __dirname + '/../routes', /^route-.*\.js$/, 6, -3, ' route');
};

var securePort = 0;

var logins = exports.logins = {};
exports.suffix = '';

var httpsT = 'http'
  , wssT = 'ws'
  , wssP = null
  ;

var checkPorts = function (port, portSecure) {
  return portscanner.checkPortStatus(port)
    .then(function (status) {
      if (status === 'open') {
        logger.error('server', { event: 'portscanner.checkPortStatus ' + port, diagnostic: 'port is taken' });
        return 'open';
      }
      return portscanner.checkPortStatus(portSecure);
    })
    .then(function (status) {
      if (status === 'open') {
        logger.error('server', { event: 'portscanner.checkPortStatus ' + portSecure, diagnostic: 'port is taken' });
        return 'open';
      }
      return status;
    })
    .catch(function (err) {
      return logger.error('server', { event: 'portscanner.checkPortStatus', diagnostic: err.message });
    });
}

var start = function (port, portSecure) {
  var server;

  var crt = __dirname + '/../sandbox/steward.home.rub.is.chain.pem'
    , key = __dirname + '/../db/steward.home.rub.is.key.pem'
    , options = {}
    //, stasis = new static.Server(__dirname + '/../sandbox')
    ;


  if (fs.existsSync(key)) {
    if (fs.existsSync(crt)) {
      /*options.key = fs.readFileSync(key);
      options.cert = fs.readFileSync(crt);
      options.server = https.createServer(options);

      exports.x509 = { key: key, crt: crt };*/
    } else return logger.error('no startup certificate', { cert: crt });
  } else return logger.error('no startup key', { key: key });

  // Starting the server
  var http = require('http');
  var https = require('https');
  var express = require("express");

  var app = express();

  var server, expressWs;
  server = http.createServer(app);
  serverSecure = https.createServer({ key: fs.readFileSync(__dirname + '/../db/steward.home.rub.is.key.pem').toString(), cert: fs.readFileSync(__dirname + '/../sandbox/steward.home.rub.is.chain.pem').toString() }, app);
  expressWs = require('express-ws')(app, server);
  expressWss = require('express-ws')(app, serverSecure);

  for (var route in routes) {
    app.ws(route, function (ws, req) {
      var tag = req.connection.remoteAddress + ' ' + req.connection.remotePort + ' ' + route;

      ws.clientInfo = steward.clientInfo(req.connection, true);
      ws.on('error', function (err) {
        logger.info(tag, { event: 'error', path: route, message: err });
      });

      (routes[route].route)(ws, tag);
    });
  }

  var ui = require('./ui');
  ui.start(server, serverSecure, app);

  server.listen(port);
  serverSecure.listen(portSecure);

  logger.info('listening on ws://*:' + port + ' and wss://*:' + portSecure);

  var addresses, i, ifaddr, ifaddrs, ifname;

  addresses = [];
  for (ifname in steward.ifaces) if (steward.ifaces.hasOwnProperty(ifname)) {
    ifaddrs = steward.ifaces[ifname];
    for (i = 0; i < ifaddrs.length; i++) {
      ifaddr = ifaddrs[i];
      if ((!ifaddr.internal) && (ifaddr.family === 'IPv4')) addresses.push(ifaddr.address);
    }
  }
  exports.suffix = '%26hostName=' + encodeURIComponent(os.hostname())
    + '%26name=' + encodeURIComponent('steward')
    + '%26ipAddresses=' + encodeURIComponent(addresses)
    + '%26port=' + encodeURIComponent(portSecure);

  fs.exists(__dirname + '/../db/' + steward.uuid + '.js', function (existsP) {
    var crt2, params;

    if (!existsP) return;
    params = require(__dirname + '/../db/' + steward.uuid).params;

    crt2 = __dirname + '/../sandbox/cloud.crt';
    fs.unlink(crt2, function (err) {
      if ((!!err) && (err.code !== 'ENOENT')) logger.error('cloud', { event: 'fs.unlink', diagnostic: err.message });
      fs.writeFile(crt2, new Buffer(params.server.ca), { mode: 0444 }, function (err) {
        if (!!err) logger.error('cloud', { event: 'fs.writeFile', diagnostic: err.message });
      });
    });
    register(params, portSecure);
  });

  utility.acquire(logger, __dirname + '/../discovery', /^discovery-.*\.js$/, 10, -3, ' discovery', portSecure);
  return;

  var server = new wsServer(options).on('connection', function (ws) {
    var request = ws.upgradeReq;
    var pathname = url.parse(request.url).pathname;
    var tag = wssT + ' ' + request.connection.remoteAddress + ' ' + request.connection.remotePort + ' ' + pathname;
    var meta;

    ws.clientInfo = steward.clientInfo(request.connection, secureP);
    meta = ws.clientInfo;
    meta.event = 'connection';
    logger.info(tag, meta);

    ws.on('error', function (err) {
      logger.info(tag, { event: 'error', message: err });
    });
    ws.on('close', function (code, message) {
      var meta = utility.clone(ws.clientInfo);

      meta.event = 'close';
      meta.code = code;
      meta.message = message;
      logger.info(tag, meta);

      broker.publish('actors', 'logout', ws.clientInfo.clientSerialNo);
      delete (logins[tag]);
    });

    if (!routes[pathname]) {
      logger.warning(tag, { event: 'route', transient: false, diagnostic: 'unknown path: ' + pathname });
      return ws.close(1008, 'not found');
    }

    // NB: each route is responsible for access control, both at start and per-message
    (routes[pathname].route)(ws, tag);
  }).on('error', function (err) {
    logger.error('server', { event: 'ws.error', diagnostic: err.message });
  })._server;
  server.removeAllListeners('request');
  server.on('request', function (request, response) {
    var u = url.parse(request.url);
    var pathname = u.pathname;
    var tag = httpsT + ' ' + request.connection.remoteAddress + ' ' + request.connection.remotePort + ' ' + pathname;
    var meta = steward.clientInfo(request.connection, secureP);

    meta.event = 'request';
    meta.method = request.method;
    logger.info(tag, meta);

    if (!places) places = require('./../actors/actor-place');

    // strict must be OFF and the request must either come from the LAN or localhost
    if ((places.place1.info.strict === 'off') && ((request.connection.localAddress !== '127.0.0.1') || !secureP)) {
      if ((pathname === '/oneshot') && (require('./../routes/route-oneshot').process(request, response, tag))) return;
    }

    if ((request.method !== 'GET') && (request.method !== 'HEAD')) {
      logger.info(tag, { event: 'invalid method', code: 405, method: request.method });
      response.writeHead(405, { Allow: 'CONNECT' });
      return response.end();
    }

    pathname = {
      '/client': '/client.html'
      , '/console': '/console.html'
    }[pathname] || pathname;

    if ((places.place1.info.strict !== 'off')
      && (!secureP)
      && (securePort !== 0)
      && (pathname !== '/index.xml')
      && (request.connection.localAddress !== '127.0.0.1')) {
      var location = 'https://' + request.connection.localAddress + ':' + securePort;

      if (!!u.pathname) location += u.pathname;
      if (!!u.hash) location += u.hash;

      logger.info(tag, { event: 'request', code: 307, location: location });
      response.writeHead(307, { location: location, 'content-length': 0 });
      return response.end();
    }

    if ((pathname.indexOf('/') !== 0) || (pathname.indexOf('..') !== -1)) {
      logger.info(tag, { event: 'invalid path', code: 404 });
      response.writeHead(404, { 'Content-Type': 'text/plain' });
      return response.end('404 not found');
    }

    u.pathname = pathname;
    request.url = url.format(u);
    stasis.serve(request, response, function (err, result) {
      if (!!err) {
        response.writeHead(err.status, err.headers);
        response.end();
        return logger.warning(tag, { code: err.status, message: err.message });
      }

      logger.info(tag,
        { code: result.status, type: result.headers['Content-Type'], octets: result.headers['Content-Length'] });
    });

    if (secureP) {
      server.listen(portno);
    }

    if (!wssP) wssP = portno;
    advertise();

    logger.info('listening on ' + wssT + '://*:' + portno);

    var hack = '0.0.0.0';
    http.createServer(function (request, response) {
      response.writeHead(302, {
        Location: httpsT + '://' + hack + ':' + portno
        , Connection: 'close'
      });
      response.end();
    }).on('connection', function (socket) {
      hack = socket.localAddress;
    }).on('listening', function () {
      logger.info('redirecting from http://*:80 to ' + httpsT + '://*:' + portno);
    }).on('error', function (err) {
      logger.info('unable to listen on http://*:80', { diagnostic: err.message });
    }).listen(80);

    if (secureP) {
      var addresses, i, ifaddr, ifaddrs, ifname;

      addresses = [];
      for (ifname in steward.ifaces) if (steward.ifaces.hasOwnProperty(ifname)) {
        ifaddrs = steward.ifaces[ifname];
        for (i = 0; i < ifaddrs.length; i++) {
          ifaddr = ifaddrs[i];
          if ((!ifaddr.internal) && (ifaddr.family === 'IPv4')) addresses.push(ifaddr.address);
        }
      }
      exports.suffix = '%26hostName=' + encodeURIComponent(os.hostname())
        + '%26name=' + encodeURIComponent('steward')
        + '%26ipAddresses=' + encodeURIComponent(addresses)
        + '%26port=' + encodeURIComponent(wssP);

      fs.exists(__dirname + '/../db/' + steward.uuid + '.js', function (existsP) {
        var crt2, params;

        if (!existsP) return;
        params = require(__dirname + '/../db/' + steward.uuid).params;

        crt2 = __dirname + '/../sandbox/cloud.crt';
        fs.unlink(crt2, function (err) {
          if ((!!err) && (err.code !== 'ENOENT')) logger.error('cloud', { event: 'fs.unlink', diagnostic: err.message });
          fs.writeFile(crt2, new Buffer(params.server.ca), { mode: 0444 }, function (err) {
            if (!!err) logger.error('cloud', { event: 'fs.writeFile', diagnostic: err.message });
          });
        });
        register(params, portno);
      });

      return;
    }

    utility.acquire(logger, __dirname + '/../discovery', /^discovery-.*\.js$/, 10, -3, ' discovery', portno);
  });
};

var wssA
  , httpsA
  ;

var advertise = exports.advertise = function () {
  var name, txt;

  if (!wssP) return;

  if (!places) places = require('./../actors/actor-place');
  if (!!places.place1) name = places.place1.name;
  if (!!exports.vous) name = exports.vous;

  txt = { uuid: steward.uuid };
  if (!!name) txt.name = name;

  if (!!mdns) {
    if (!!wssA) wssA.stop();
    wssA = mdns.createAdvertisement(mdns.tcp(wssT), wssP, { name: 'steward', txtRecord: txt })
      .on('error', function (err) {
        logger.error('mdns', {
          event: 'createAdvertisement steward ' + wssT + ' ' + wssP
          , diagnostic: err.message
        });
      });
    wssA.start();

    if (!!httpsA) httpsA.stop();
    httpsA = mdns.createAdvertisement(mdns.tcp(httpsT), wssP, { name: 'steward', txtRecord: txt })
      .on('error', function (err) {
        logger.error('mdns', {
          event: 'createAdvertisement steward ' + httpsT + ' ' + wssP
          , diagnostic: err.message
        });
      });
    httpsA.start();
    return;
  }

  if (!!avahi) {
    txt = 'uuid ' + steward.uuid;
    if (!!name) txt += ' name ' + name;

    if (!!wssA) wssA.remove();
    wssA = avahi.publish({ name: 'steward', type: '_' + wssT + '._tcp', port: wssP, data: txt });

    if (!!httpsA) httpsA.remove();
    httpsA = avahi.publish({ name: 'steward', type: '_' + httpsT + '._tcp', port: wssP, data: txt });
  }
};


exports.vous = null;
exports.suffix = '';

var responders = 0;

var register = function (params, portno) {
  if (responders > 14) return;

  var didP, options, u;

  var retry = function (secs) {
    if (didP) return;
    didP = true;

    if (responders > 0) responders--;
    setTimeout(function () { register(params, portno); }, secs * 1000);
  };

  u = url.parse(params.issuer);
  options = {
    host: params.server.hostname
    , port: params.server.port
    , method: 'PUT'
    , path: '/register/' + params.labels[0]
    , headers: {
      authorization: 'TOTP '
      + 'username="' + params.uuid[0] + '", '
      + 'response="' + speakeasy.totp({
        key: params.base32
        , length: 6
        , encoding: 'base32'
        , step: params.step
      }) + '"'
      , host: u.hostname + ':' + params.server.port
    }
    , agent: false
  };
  didP = false;
  https.request(options, function (response) {
    var content = '';

    response.setEncoding('utf8');
    response.on('data', function (chunk) {
      content += chunk.toString();
    }).on('end', function () {
      if (response.statusCode !== 200) {
        logger.error('register', { event: 'response', code: response.statusCode, retry: '15 seconds' });

        return retry(15);
      }

      u = url.parse('http://' + content);
      rendezvous(params, portno, u);

      register(params, portno);
    }).on('close', function () {
      logger.warning('register', { event: 'close', diagnostic: 'premature eof', retry: '1 second' });

      retry(1);
    });
  }).on('error', function (err) {
    logger.error('register', { event: 'error', diagnostic: err.message, retry: '10 seconds' });

    retry(10);
  }).end();
  responders++;
};

var rendezvous = function (params, portno, u) {
  var didP, remote;

  var retry = function (secs) {
    if (didP) return;
    didP = true;

    if (responders > 0) responders--;
    setTimeout(function () { register(params, portno); }, secs * 1000);
  };

  didP = false;
  remote = new net.Socket({ allowHalfOpen: true });
  remote.on('connect', function () {
    var head, local;

    logger.debug('rendezvous', { event: 'connect', server: u.host });

    remote.setNoDelay(true);
    remote.setKeepAlive(true);

    head = null;
    local = null;
    remote.on('data', function (data) {
      head = (!!head) ? Buffer.concat([head, data]) : data;
      if (!!local) return;

      local = new net.Socket({ allowHalfOpen: true });
      local.on('connect', function () {
        logger.debug('rendezvous', { event: 'connect', server: '127.0.0.1:' + portno });

        local.setNoDelay(true);
        local.setKeepAlive(true);

        local.write(head);
        remote.pipe(local).pipe(remote);
      }).on('error', function (err) {
        logger.info('rendezvous', { event: 'error', server: '127.0.0.1:' + portno, diagnostic: err.message });

        try { remote.destroy(); } catch (ex) { }
      }).connect(portno, '127.0.0.1');

      retry(0);
    });
  }).on('close', function (errorP) {
    if (errorP) logger.error('rendezvous', { event: 'close', server: u.host });
    else logger.debug('rendezvous', { event: 'close', server: u.host });

    retry(1);
  }).on('error', function (err) {
    if (err.errno === 'EMFILE') {
      logger.alert('rendezvous', { event: 'error', server: u.host, diagnostic: err.message });
      return process.exit(2);
    }
    logger.error('rendezvous', { event: 'error', server: u.host, diagnostic: err.message });

    retry(10);
  }).on('end', function () {
    logger.debug('rendezvous', { event: 'end', server: u.host });

    retry(5);
  }).connect(u.port, u.hostname);
};
