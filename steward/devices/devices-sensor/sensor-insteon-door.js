var pair
  , utility     = require('./../../core/utility')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , broker      = utility.broker
  , sensor      = require('./../device-sensor')
  , stringify   = require('json-stringify-safe')
  , util        = require('util')
  ;

try {
  pair = require('./../devices-gateway/gateway-insteon-automategreen').pair;
} catch(ex) {
  exports.start = function() {};

  return utility.logger('devices').info('failing insteon-door sensor (continuing)', { diagnostic: ex.message });
}

var logger = sensor.logger;

var Insteon_Door = exports.Device = function(deviceID, deviceUID, info) {
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.status = 'waiting';
  self.changed();

  self.gateway = info.gateway;
  self.insteonID = info.device.unit.serial;
  self.info = { lastSample: null };

  self.door = self.gateway.insteon.door(self.insteonID);
  self.door.on('opened', function() {
    self.update(self, 'opened');
  });
  self.door.on('closed', function() {
    self.update(self, 'closed');
  });
  self.door.on('heartbeat', function() {
    self.update(self, 'heartbeat');
  });

  broker.subscribe('actors', function(request, eventID, actor, observe, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });

  if (!!self.gateway.upstream) self.gateway.upstream[self.insteonID] = self;
};
util.inherits(Insteon_Door, sensor.Device);
Insteon_Door.prototype.perform = devices.perform;

Insteon_Door.prototype.update = function(self, status) {
  if ((!!status) && (status !== self.status)) {
    self.status = status;
    self.changed();
  }
};

exports.start = function() {
  steward.actors.device.sensor.insteon = steward.actors.device.sensor.insteon ||
      { $info     : { type: '/device/sensor/insteon' } };

  steward.actors.device.sensor.insteon.door =
      { $info     : { type       : '/device/sensor/insteon/door'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name       : true
                                   , status     : [ 'waiting', 'opened', 'closed' ]
                                   , lastSample : 'timestamp'
                                   }
                    }
      , $validate : {
                    }
      };
  devices.makers['Insteon.1002'] = Insteon_Door;
  pair ({ '/device/sensor/insteon/door' : { maker   :   Insteon_Door
                                           , entries : [ '1002' ]
                                           }
        });
};
