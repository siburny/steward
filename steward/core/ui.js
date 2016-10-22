var utility = require('./../core/utility');


var logger = exports.logger = utility.logger('ui');

var nodes_whitelist = [
  //"node-red/sentiment",
  "node-red-contrib-schedex/schedex",
  "node-red/inject",
  "node-red/catch",
  "node-red/status",
  "node-red/debug",
  "node-red/link",
  "node-red/exec",
  "node-red/function",
  "node-red/template",
  "node-red/delay",
  "node-red/trigger",
  "node-red/comment",
  "node-red/httprequest",
  "node-red/switch",
  "node-red/change",
  "node-red/range",
  "node-red/split",
  //"node-red/CSV",
  //"node-red/HTML",
  //"node-red/JSON",
  //"node-red/XML",
  //"node-red/tail",
  //"node-red/file",
  "node-red-node-email/email",
  //"node-red-node-feedparser/feedparse",
  "node-red-node-rbe/rbe",
  //"node-red-node-serialport/serialport",
  //"node-red-node-twitter/twitter"
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
        if (nodes_whitelist.indexOf(nodes[i].id) === -1) {
          RED.nodes.disableNode(nodes[i].id);
        } else {
          RED.nodes.enableNode(nodes[i].id);
        }
      }
    });
};
