// Wemo Motion: http://www.belkin.com/us/wemo-motion

var stringify   = require('json-stringify-safe')
  , util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , broker      = utility.broker
  , discovery   = require('./../../discovery/discovery-ssdp')
  , indicator      = require('./../device-indicator')
  ;


var logger = indicator.logger;

var Indicator_Clock = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = '/device/indicator/clock-widget';
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.status = 'waiting';
  self.changed();
  self.info = {};

  broker.on('actors', function(request, eventID, actor, observe, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, eventID, observe, parameter);
  });

  setInterval(function() {
    self.update();
  }, 10000)
};
util.inherits(Indicator_Clock, indicator.Device);

Indicator_Clock.prototype.update = function() {
  if(this.status === 'waiting') {
    this.status = 'live';
  }
  this.info.date = new Date();
  this.changed();
}

function announce() {
  var info = {};
  info.device = { url          : null
                , name         : 'Clock'
                , manufacturer : ''
                };
  info.deviceType = "/device/indicator/clock-widget";
  info.id = "clock";
  if (!!devices.devices[info.id]) return;

  logger.info('found', { id: info.id });
  devices.discover(info);
};


exports.start = function() {
  steward.actors.device.indicator['clock-widget'] = steward.actors.device.indicator['clock-winget'] ||
    { $info     : { type       : '/device/indicator/clock-widget'
                  , observe    : [ ]
                  , perform    : [ ]
                  , properties : { name       : true
                                  , status     : [ 'waiting', 'live' ]
                                  , lastSample : 'timestamp'
                                  }
                  }
    , $validate : {
                  }
    };
  devices.makers['/device/indicator/clock-widget'] = Indicator_Clock;

  setTimeout(function() {
    announce();
  }, 100);
};
