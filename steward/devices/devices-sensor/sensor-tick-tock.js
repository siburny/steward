// Wemo Motion: http://www.belkin.com/us/wemo-motion

var stringify   = require('json-stringify-safe')
  , util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , broker      = utility.broker
  , discovery   = require('./../../discovery/discovery-ssdp')
  , sensor      = require('./../device-sensor')
  ;


var logger = sensor.logger;

var Sensor_Tick_Tock = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = '/device/sensor/ticktock';
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.status = 'waiting';
  self.changed();
  self.info = {};

  broker.subscribe('actors', function(request, eventID, actor, observe, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, eventID, observe, parameter);
  });

  setInterval(function() {
    self.update();
  }, 10000)
};
util.inherits(Sensor_Tick_Tock, sensor.Device);

Sensor_Tick_Tock.prototype.perform = function(self, taskID, perform, parameter) {
  if (perform === 'set') return devices.perform(self, taskID, perform, parameter);

  if (perform === 'toggle') {
    logger.info('device/' + self.deviceID, { perform: perform });

    self.update();

    return steward.performed(taskID);
  }
};


Sensor_Tick_Tock.prototype.update = function() {
  if(this.status === 'waiting') {
    this.status = 'tick';
  } else {
    this.status = this.status === 'tick' ? 'tock' : 'tick';
  }
  this.changed();
}

function announce(i) {
  var info = {};
  info.device = { url          : null
                , name         : 'Tick Tock Sensor ' + i
                , manufacturer : ''
                };
  info.deviceType = "/device/sensor/ticktock";
  info.id = "tick-tock-"+i;
  if (!!devices.devices[info.id]) return;

  logger.info('found', { id: info.id });
  devices.discover(info);
};


exports.start = function() {
  steward.actors.device.sensor.ticktock = steward.actors.device.sensor.ticktock ||
    { $info     : { type       : '/device/sensor/ticktock'
                  , observe    : [ ]
                  , perform    : [ ]
                  , properties : { name       : true
                                  , status     : [ 'waiting', 'tick', 'tock' ]
                                  , lastSample : 'timestamp'
                                  }
                  }
    , $validate : {
                  }
    };
  devices.makers['/device/sensor/ticktock'] = Sensor_Tick_Tock;

  setTimeout(function() {
    announce(1);
  }, 500);
};
