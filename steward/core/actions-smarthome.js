exports.handler = function (req, res, next) {
  if (!!req.body) {
    var reqId = req.body.requestId;
    for (i = 0; i < req.body.inputs.length; i++) {
      var input = req.body.inputs[i];
      switch (input.intent) {
        case 'action.devices.SYNC':
          break;
      }
    }
  }
}