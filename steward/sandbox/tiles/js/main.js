var api = new API();

var grid = null;
var update_functions = {};
var editform = null;

function initGrid() {
  if (!!grid) {
    grid.gridList('destroy');
    grid = null;
  }

  grid = $('#grid').gridList({
    dragAndDrop: false,
    direction: 'vertical',
    lanes: 16,
    widthHeightRatio: 1,
    heightToFontSizeRatio: 0.5
  });
  $(window).resize();
}

var editor_callback, callback_fields, editor_device_id;

function open_edit_form(id, fields, actions, callback) {
  actions = actions || {};
  fields = fields || {};

  editor_device_id = id;
  if (typeof actions === 'function') {
    callback = actions;
    actions = {};
  }
  editor_callback = callback;

  var default_fields = {
    'name': 'Name',
    'nickname': 'Nickname',
    'room': 'Room'
  };
  for (var field in default_fields) {
    if (!fields.hasOwnProperty(field)) {
      fields[field] = {
        'name': default_fields[field],
        'value': ''
      };
    }
  }

  $('#settings form').empty();
  callback_fields = [];
  for (var field in fields) {
    $row = $('<div class="row"><div class="input-field"><input id="' + field + '" type="text" class="validate" value="' + fields[field].value + '"><label for="' + field + '">' + fields[field].name + '</label></div></div>')
    $('#settings form').append($row);
    callback_fields.push(field);
  }

  $('#settings .actions').empty();
  for (var action in actions) {
    $row = $('<a href="#!" class="modal-' + action + ' waves-effect waves-green btn">' + actions[action].name + '</a><br />');
    $('#settings .actions').append($row);

    $('#settings .actions .modal-' + action).on('click', (function (_action, _api) {
      return function () {
        _action.click(_api);
      }
    })(actions[action], api));
  }

  var data = {
    "Apple": null,
    "Microsoft": null,
    "Google": null
  };

  $('#settings form input#room').autocomplete({
    data: data,
    limit: 3,
    minLength: 1
  });
  $('#settings').modal('open');
  M.updateTextFields();
}

function onclose_edit_form(cancel) {
  $('#settings').modal('close');

  if (cancel) {
    return;
  }

  var ret = {};
  for (let index in callback_fields) {
    let field = callback_fields[index];
    ret[field] = $('#settings form input#' + field).val();
  }

  if (!!editor_callback) {
    editor_callback(ret || {});
  }

  if (!!editor_device_id) {
    api.perform(editor_device_id, 'set', ret);
  }
}

$(function () {
  api.connect();

  $(".sidenav").sidenav();

  // init grid
  initGrid();
  $(window).resize(function () {
    newsize = Math.ceil(1.0 * $(document).width() / 119);

    grid.gridList('resize', newsize);
  });

  //init editor
  $('.modal').modal({
    dismissible: false
  });
  $('.modal .modal-footer .modal-cancel').on('click', function () {
    onclose_edit_form(true);
  });
  $('.modal .modal-footer .modal-save').on('click', function () {
    onclose_edit_form();
  });
});

function close_toast(class_name) {
  if (class_name.length > 0) {
    class_name = '.' + class_name;
  }

  var toastElement = document.querySelector('.toast' + class_name);
  if (toastElement != null) {
    var toastInstance = M.Toast.getInstance(toastElement);
    toastInstance.dismiss();
  }
}

function API() {
  this.websocket = null;
  this.timeout = 5;
}
API.prototype.connect = function () {
  var self = this;

  this.websocket = new WebSocket((window.location.protocol === 'http:' ? 'ws:' : 'wss:') + '//' + window.location.host + '/api/');
  this.websocket.onopen = function (evt) {
    self.timeout = 5;

    close_toast('connected');
    M.toast({
      html: 'Connected.',
      displayLength: 2000,
      classes: 'connected',
    });

    setTimeout(function () {
      self.websocket.send(JSON.stringify({
        'action': 'loadDevices'
      }));
    }, 500);
  };

  this.websocket.onclose = function (evt) {
    close_toast('closed');
    M.toast({
      html: 'Connection closed.',
      displayLength: 2000,
      classes: 'closed',
    });
    self.reconnect();
  };

  this.websocket.onmessage = function onMessage(evt) {
    if (!!evt && !!evt.data) {
      var msg = JSON.parse(evt.data);

      if ($('#grid #device-' + msg.id).length == 0) {
        $('#grid').append(msg.html);
        initGrid();
      }
      if (update_functions.hasOwnProperty('update_' + msg.id)) {
        $('#device-' + msg.id).attr('data-status', msg.status);
        update_functions['update_' + msg.id](msg);
      }

    }
  }
  this.websocket.onerror = function (evt) {
    close_toast('retrying');
    M.toast({
      html: 'Error connecting. Retrying ... ',
      displayLength: 2000,
      classes: 'retrying',
    });

    //self.timeout *= 2;
    if (self.timeout > 60) {
      self.timeout = 60;
    }
  };
}

API.prototype.close = function () {
  if (!!this.websocket) {
    this.websocket.close();
  }
  this.websocket = null;
}

API.prototype.reconnect = function () {
  close_toast('connecting');
  M.toast({
    html: 'Connecting in&nbsp;<span id="RetryTimeout">' + this.timeout + '</span>&nbsp;second(s)',
    displayLength: this.timeout * 1000,
    class: 'connecting',
  });

  var timeout = this.timeout;
  var interval = setInterval(function () {
    if (--timeout <= 0) {
      clearInterval(interval);
    } else {
      $('#RetryTimeout').text(timeout);
    }
  }, 1000)

  this.close();
  var self = this;
  setTimeout(function () {
    self.connect();
  }, this.timeout * 1000);
}

API.prototype.perform = function (id, action, params) {
  if (!!this.websocket) {
    this.websocket.send(JSON.stringify({
      'id': id,
      'action': 'perform',
      'method': action,
      'params': JSON.stringify(params)
    }));
  }
}

/*
 * Replace all SVG images with inline SVG
 */
$.embedSVG = function () {
  $('img[src$=".svg"]').each(function () {
    var $img = $(this);
    var imgID = $img.attr('id');
    var imgClass = $img.attr('class');
    var imgURL = $img.attr('src');
    $.get(imgURL, function (data) {
      // Get the SVG tag, ignore the rest
      var $svg = $(data).find('svg');

      // Add replaced image's ID to the new SVG
      if (typeof imgID !== 'undefined') {
        $svg = $svg.attr('id', imgID);
      }
      // Add replaced image's classes to the new SVG
      if (typeof imgClass !== 'undefined') {
        $svg = $svg.attr('class', imgClass + ' replaced-svg');
      }

      // Remove any invalid XML tags as per http://validator.w3.org
      $svg = $svg.removeAttr('xmlns:a');

      // Replace image with new SVG
      $img.replaceWith($svg);

    }, 'xml');

  });
};