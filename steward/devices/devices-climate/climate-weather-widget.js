var stringify = require('json-stringify-safe')
  , util = require('util')
  , devices = require('./../../core/device')
  , steward = require('./../../core/steward')
  , utility = require('./../../core/utility')
  , broker = utility.broker
  , climate = require('./../device-climate')
  , places      = require('./../../actors/actor-place')
  ;

var logger = climate.logger;

var Weather_Widget = exports.Device = function (deviceID, deviceUID, info) {
  var self = this;

  self.whatami = '/device/climate/weather-widget';
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.status = 'waiting';
  self.changed();
  self.info = {};

  broker.on('actors', function (request, eventID, actor, observe, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, eventID, observe, parameter);
  });

  broker.on('beacon-egress', function(category, data) {
    if(category == '.updates'){
      if(!Array.isArray(data))
      {
        data = [data];
      }

      for(var i in data)
      {
        var item = data[i];
        if(!!item && !!item.whatami && item.whatami ==='/place' && !!item.info.conditions)
        {
          self.status = 'live';
          self.info.conditions = item.info.conditions;
          self.info.forecasts = item.info.forecasts;
          self.changed();
        }
      }
    }
  });
};
util.inherits(Weather_Widget, climate.Device);

function announce() {
  var info = {};
  info.device = {
    url: null
    , name: 'Weather'
    , manufacturer: ''
  };
  info.deviceType = "/device/climate/weather-widget";
  info.id = "weather";
  if (!!devices.devices[info.id]) return;

  logger.info('found', { id: info.id });
  devices.discover(info);
};


exports.start = function () {
  steward.actors.device.climate['weather-widget'] = steward.actors.device.climate['weather-winget'] ||
    {
      $info: {
        type: '/device/climate/weather-widget'
        , observe: []
        , perform: []
        , properties: {
          name: true
          , status: ['waiting', 'live']
          , lastSample: 'timestamp'
        }
      }
      , $validate: {
      }
    };
  devices.makers['/device/climate/weather-widget'] = Weather_Widget;

  setTimeout(function () {
    announce();
  }, 100);
};
