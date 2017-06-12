var devices = require('./device');

const supportedThings = {
  '/device/switch/insteon/onoff': {
    'type': 'action.devices.types.SWITCH',
    'traits': ['action.devices.traits.OnOff'],
    'params': function (device) {
      return {
        'online': device.status !== 'waiting',
        'on': device.status === 'on'
      };
    }
  },
  '/device/switch/insteon/dimmer': {
    'type': 'action.devices.types.SWITCH',
    'traits': ['action.devices.traits.OnOff', 'action.devices.traits.Brightness'],
    'params': function (device) {
      return {
        'online': device.status !== 'waiting',
        'on': device.status === 'on',
        'brightness': device.info.level
      };
    }
  }
}

exports.handler = function (req, res, next) {
  if (!!req.body) {
    var reqId = req.body.requestId;
    for (i = 0; i < req.body.inputs.length; i++) {
      var input = req.body.inputs[i];
      switch (input.intent) {
        case 'action.devices.SYNC':
          var ret = { "requestId": reqId, "payload": { "devices": [] } };

          for (var deviceUID in devices.devices) {
            const device = devices.devices[deviceUID].device;

            if (supportedThings.hasOwnProperty(device.whatami)) {
              ret.payload.devices.push({
                'id': device.deviceID,
                'type': supportedThings[device.whatami].type,
                'traits': supportedThings[device.whatami].traits,
                'name': {
                  'defaultNames': [deviceUID],
                  'name': device.name
                },
                'willReportState': false
              });
            }
          }

          res.json(ret);

          break;

        case 'action.devices.QUERY':
          var ret = { "requestId": reqId, "payload": { "devices": {} } };

          for (var index in input.payload.devices) {
            var device = devices.id2device(input.payload.devices[index].id);
            if (!!device && supportedThings.hasOwnProperty(device.whatami)) {
              ret.payload.devices[input.payload.devices[index].id] = supportedThings[device.whatami].params(device);
            }
          }

          res.json(ret);

          break;

        case 'action.devices.EXECUTE':
          var ret = { "requestId": reqId, "payload": { "commands": [] } };

          for (let index in input.payload.commands) {
            var command = input.payload.commands[index];

            var devs = [];
            for (let index in command.devices) {
              let device = devices.id2device(command.devices[index].id);
              if (!!device) {
                devs.push(device);
              }
            }

            for (let index in command.execution) {
              let execution = command.execution[index];
              switch (execution.command) {
                case 'action.devices.commands.OnOff':
                  for (let device in devs) {
                    devs[device].perform(devs[device], null, execution.params.on ? 'on' : 'off');
                  }
                  break;
              }
              ret.payload.commands.push({ 'ids': devs.reduce(function(result, value) { result.push(value.deviceID); return result; }, []), 'status': 'SUCCESS', "states": { "on": execution.params.on, "online": true } });
            }

            res.json(ret);
          }

          break;
      }
    }
  }
}


/*
{
      "id": "123",
      "type": "action.devices.types.OUTLET",
      "traits": [
        "action.devices.traits.OnOff"
      ],
      "name": {
        "defaultNames": ["My Outlet 1234"],
        "name": "Night light",
        "nicknames": ["wall plug"]
      },
      "willReportState": true,
        "deviceInfo": {
          "manufacturer": "lights-out-inc",
          "model": "hs1234",
          "hwVersion": "3.2",
          "swVersion": "11.4"
        },
        "customData": {
          "fooValue": 74,
          "barValue": true,
          "bazValue": "foo"
        }
    }
  */