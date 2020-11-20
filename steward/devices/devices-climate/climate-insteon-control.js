// Insteon wired thermostat: http://www.insteon.com/pdf/2441TH.pdf

var pair
  , utility     = require('./../../core/utility')
  ;

try {
  pair = require('./../devices-gateway/gateway-insteon-automategreen').pair;
} catch(ex) {
  exports.start = function() {};

  return utility.logger('devices').info('failing insteon-control climate (continuing)', { diagnostic: ex.message });
}

var util        = require('util')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , climate     = require('./../device-climate')
  , sensor      = require('./../device-sensor')
  ;


// var logger = climate.logger;


var Thermostat = exports.Device = function(deviceID, deviceUID, info) {
  var self;

  self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();
  if (!self.ikon) self.setIkon('control-thermostat');

  self.status = 'waiting';
  self.changed();
  self.gateway = info.gateway;
  self.insteonID = info.device.unit.serial;
  self.info = {};

  self.thermostat = self.gateway.insteon.thermostat(self.insteonID);
  self.thermostat.monitor(true);

  self.thermostat.on('status', function(status) {
    self.update(self, status);
  });
  self.thermostat.on('cooling', function(mode) {
    self.setStatus(self, 'cooling');
  });
  self.thermostat.on('heating', function(mode) {
    self.setStatus(self, 'heating');
  });
  self.thermostat.on('highHumidity', function(mode) {
    self.setStatus(self, 'highHumidity');
  });
  self.thermostat.on('lowHumidity', function(mode) {
    self.setStatus(self, 'lowHumidity');
  });
  self.thermostat.on('normalHumidity', function(mode) {
    self.setStatus(self, 'normalHumidity');
  });
  self.thermostat.on('off', function(mode) {
    self.setStatus(self, 'off');
  });

  utility.broker.on('actors', function(request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });

  self.refresh(self);
  // debug
  //setInterval(function() { self.refresh(self); }, 30 * 1000);
};
util.inherits(Thermostat, climate.Device);

Thermostat.prototype.refresh = function(self) {
  self.thermostat.status(function(err, status) {
    if(!!err) {
      self.status = 'warning';
      self.changed();
    } else {
      self.update(self, status);
    }
  });
};

Thermostat.prototype.setStatus = function(self, status) {
  if(!!status && self.status !== status)
  {
    self.status = status;
    self.changed();
  }
}

Thermostat.prototype.update = function(self, params) {
  var p, updateP;

  updateP = false;
  if (self.status === 'waiting') {
    self.status = 'off';
    updateP = true;
  }

  var f = { temperature  : function(v) {
// if fahrenheit, convert to celcius
                             if (self.info.temperature === v) return;

                             self.info.temperature = v;
                             updateP = true;
                           }

          , humidity     : function(v) {
                             if (self.info.humidity === v) return;

                             self.info.humidity = v;
                             updateP = true;
                           }

          , energySaving : function(v) {
                             if (self.info.away === v) return;

                             self.info.away = v;
                             updateP = true;
                           }

          , mode         : function(v) {
                             if (self.info.hvac === v) return;

                             self.info.hvac = v;
                             updateP = true;
                           }

          , fan          : function(v) {
                             var fan = v ? 'on' : 'auto';

                             if (self.info.fan !== fan) {
                               self.info.fan = fan;
                               updateP = true;
                             }
                           }

            , setpoints :  function(v) {
                             var goalTemperature = (params.mode === 'heat') ? v.heat : v.cool;

                             if (self.info.goalTemperature === goalTemperature) return;

                             self.info.goalTemperature = goalTemperature;
                             updateP = true;
                           }
          };
  for (p in params) if ((params.hasOwnProperty(p)) && (!!f[p])) f[p](params[p]);

  if (updateP) {
    self.info.lastSample = new Date().getTime();
    self.changed();
    sensor.update(self.deviceID, { lastSample  : self.info.lastSample
                                 , temperature : self.info.temperature
                                 , humidity    : self.info.humidity
                                 });
  }
};

Thermostat.operations =
{ set: function(self, params) {
         devices.attempt_perform('name', params, function(value) {
           self.setName(value);
         });
         devices.attempt_perform('ikon', params, function(value) {
           self.setIkon(value);
         });

         devices.attempt_perform('away', params, function(value) {
// set energySaving to true or false
         });

         devices.attempt_perform('hvac', params, function(value) {
           switch (value) {
             case 'off':
             case 'cool':
             case 'heat':
             case 'auto':
               self.thermostat.mode(value, function(err, value) {
                 self.update(self, { 'mode': value });
               });
               break;
            }
         });

         devices.attempt_perform('fan', params, function(value) {
           switch (value) {
             case 'on':
               break;

             case 'auto':
               break;
           }
         });

         devices.attempt_perform('goalTemperature', params, function(value) {
           var goalTemperature;

           goalTemperature = parseInt(value, 10);
           if (isNaN(goalTemperature)) return;
            // set setpoints.cool and setpoints.heat
         });
       }
};

Thermostat.prototype.perform = function(self, taskID, perform, parameter) {
  var params;

  try { params = JSON.parse(parameter); } catch(e) { params = {}; }

  if (!Thermostat.operations[perform]) return devices.perform(self, taskID, perform, parameter);

  Thermostat.operations[perform](this, params);
  setTimeout(function() { self.refresh(self); }, 0);
  return steward.performed(taskID);
};

var validate_perform = function(perform, parameter) {
  var params = {}
    , result = { invalid: [], requires: [] }
    ;

  if (!!parameter) try { params = JSON.parse(parameter); } catch(ex) { result.invalid.push('parameter'); }

  if (!Thermostat.operations[perform]) return devices.validate_perform(perform, parameter);

  if (!params) return result;

  devices.validate_param('name',            params, result, false, {                                    });
  devices.validate_param('ikon',            params, result, false, {                                    });
  devices.validate_param('away',            params, result, false, { off:  1, on:  1                    });
  devices.validate_param('hvac',            params, result, false, { off:  1, auto: 1, heat: 1, cool: 1 });
  devices.validate_param('fan',             params, result, false, {          on:  1, auto: 1           });
  devices.validate_param('goalTemperature', params, result, true,  {                                    });

  return result;
};


exports.start = function() {
  steward.actors.device.climate.insteon = steward.actors.device.climate.insteon ||
      { $info     : { type: '/device/climate/insteon' } };

  steward.actors.device.climate.insteon.control =
      { $info     : { type       : '/device/climate/insteon/control'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name            : true
                                   , status          : [ 'waiting', 'absent', 'cooling', 'heating', 'highHumidity', 'lowHumidity', 'normalHumidity', 'off' ]
                                   , lastSample      : 'timestamp'
                                   , temperature     : 'celsius'
                                   , humidity        : 'percentage'
                                   , away            : [ 'on', 'off' ]
                                   , hvac            : [ 'cool', 'heat', 'auto', 'off' ]
                                   , fan             : [ 'on', 'auto' ]
                                   , goalTemperature : 'celsius'
                                   }
                    }
        , $validate : { perform    : validate_perform }
      };

  pair ({ '/device/climate/insteon/control' : { maker   :   Thermostat
                                            , entries : [ '0508', '050b', '090d'  ]
                                            }
        });
};
