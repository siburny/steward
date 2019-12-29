var util = require('util'),
  devices = require('./../../core/device'),
  steward = require('./../../core/steward'),
  utility = require('./../../core/utility'),
  motive = require('./../device-motive');

var pair;
try {
  pair = require('./../devices-gateway/gateway-insteon-automategreen').pair;
} catch (ex) {
  exports.start = function () {};

  return utility.logger('devices').info('failing insteon-garagedoor (continuing)', {
    diagnostic: ex.message
  });
}


var logger = motive.logger;

var GarageDoor = exports.Device = function (deviceID, deviceUID, info) {
  var self = this;

  self.whatami = info.deviceType;
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.status = 'waiting';
  self.gateway = info.gateway;
  self.insteonID = info.device.unit.serial;
  self.info = {};
  self.changed();

  self.garage = self.gateway.insteon.garage(self.insteonID);

  self.garage.on('opening', () => self.update('waiting'));
  self.garage.on('closing', () => self.update('waiting'));
  self.garage.on('open', () => self.update('open'));
  self.garage.on('closed', () => self.update('closed'));

  self.refresh();

  utility.broker.on('actors', function (request, taskID, actor, perform, parameter) {
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return self.perform(self, taskID, perform, parameter);
  });
};
util.inherits(GarageDoor, motive.Device);

GarageDoor.prototype.refresh = function () {
  var self = this;
  self.garage.status()
    .then(function (status) {
      self.update(status);
    })
    .catch(function (err) {
      return logger.error('device/' + self.deviceID, {
        event: 'garage.status',
        diagnostic: err.message
      });
    });
};

GarageDoor.prototype.update = function (status) {
  if (this.status === status) return;

  this.status = status;
  return this.changed();
};

GarageDoor.prototype.perform = function (self, taskID, perform, parameter) {
  var params;

  try {
    params = JSON.parse(parameter);
  } catch (ex) {
    params = {};
  }

  switch (perform) {
    case 'set':
      return devices.perform(self, taskID, perform, parameter);

    case 'open':
      this.garage.open();
      break;

    case 'close':
      this.garage.close();
      break;

    default:
      return false;
  }

  self.status = 'waiting';
  self.changed();

  return steward.performed(taskID);
};

var validate_perform = function (perform, parameter) {
  var params = {},
    result = {
      invalid: [],
      requires: []
    };

  if (!!parameter) try {
    params = JSON.parse(parameter);
  } catch (ex) {
    result.invalid.push('parameter');
  }

  switch (perform) {
    case 'set':
      if (!params.name) result.requires.push('name');
      break;

    case 'open':
    case 'close':
      break;

    default:
      result.invalid.push('perform');
      break;
  }

  return result;
};


exports.start = function () {
  steward.actors.device.motive.insteon = steward.actors.device.motive.insteon || {
    $info: {
      type: '/device/motive/insteon'
    }
  };

  steward.actors.device.motive.insteon.garagedoor = {
    $info: {
      type: '/device/motive/insteon/garagedoor',
      observe: [],
      perform: ['open', 'close'],
      properties: {
        name: true,
        status: ['closed', 'open', 'closing', 'opening'],
        lastSample: 'timestamp'
      }
    },
    $validate: {
      perform: validate_perform
    }
  };

  devices.makers['Insteon.0700'] = GarageDoor;

  pair({
    '/device/motive/insteon/garagedoor': {
      maker: GarageDoor,
      entries: ['0700']
    }
  });
};