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

exports.start = function () {
  var http = require('http');
  var express = require("express");
  var RED = require("node-red");

  var app = express();
  var server = http.createServer(app);

  var settings = {
    httpAdminRoot: '/',
    httpNodeRoot: '/api/',
    userDir: './db/node-red/',
    functionGlobalContext: {}
  };

  RED.init(server, settings);

  app.use(settings.httpAdminRoot, RED.httpAdmin);
  app.use(settings.httpNodeRoot, RED.httpNode);

  server.listen(8000);

  RED.start()
    .then(function () {
      return RED.nodes.loadFlows();
    })
    .then(function () {
      var nodes = RED.nodes.getNodeList();
      for (i = 0; i < nodes.length; i++) {
        if (nodes_blacklist.indexOf(nodes[i].id) !== -1) {
          RED.nodes.disableNode(nodes[i].id);
        } else {
          RED.nodes.enableNode(nodes[i].id);
        }
      }
    });
};
