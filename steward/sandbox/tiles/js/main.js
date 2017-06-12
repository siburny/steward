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

var callback_editor, callback_fields;
function open_edit_form(fields, callback) {
  callback_editor = callback;
  fields = fields || {};

  var default_fields = { 'name': 'Name', 'nickname': 'Nickname', 'room': 'Room' };
  for (var field in default_fields) {
    if (!fields.hasOwnProperty(field)) {
      fields[field] = { 'name': default_fields[field], 'value': '' };
    }
  }

  $('#settings form').empty();
  callback_fields = [];
  for (var field in fields) {
    $row = $('<div class="row"><div class="input-field"><input id="' + field + '" type="text" class="validate" value="' + fields[field].value + '"><label for="' + field + '">' + fields[field].name + '</label></div></div>')
    $('#settings form').append($row);
    callback_fields.push(field);
  }

  $('#settings').modal('open');
  Materialize.updateTextFields();
}

function onclose_edit_form(cancel) {
  var ret = {};
  for (var field in callback_fields) {
    ret[field] = $('#settings form input#'+field).value();
  }

  $('#settings').modal('close');

  if (!!callback_editor && !cancel) {
    callback_editor(ret || {});
  }
}

$(function () {
  api.connect();

  $(".button-collapse").sideNav();

  // init grid
  initGrid();
  $(window).resize(function () {
    newsize = Math.ceil(1.0 * $(document).width() / 119);

    grid.gridList('resize', newsize);
  });

  //init editor
  $('.modal').modal({ dismissible: false });
  $('.modal .modal-footer .modal-cancel').on('click', function () { onclose_edit_form(true); });
  $('.modal .modal-footer .modal-save').on('click', function () { onclose_edit_form(); });
});

function API() {
  this.websocket = null;
  this.timeout = 5;
}
API.prototype.connect = function () {
  var self = this;

  this.websocket = new WebSocket((window.location.protocol === 'http:' ? 'ws:' : 'wss:') + '//' + window.location.host + '/api/');
  this.websocket.onopen = function (evt) {
    self.timeout = 5;
    Materialize.toast('Connected.', 2000);

    setTimeout(function () {
      self.websocket.send(JSON.stringify({ 'action': 'loadDevices' }));
    }, 500);
  };
  this.websocket.onclose = function (evt) {
    Materialize.toast('Connection closed.', 2000);
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
        if (msg.status !== 'waiting') {
          $('#device-' + msg.id).removeClass('waiting');
        } +
          update_functions['update_' + msg.id](msg);
      }
    }
  }
  this.websocket.onerror = function (evt) {
    Materialize.toast('Error connecting. Retrying ... ', 2000);

    self.timeout *= 2;
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
  Materialize.toast('Connecting in&nbsp;<span id="RetryTimeout">' + this.timeout + '</span>&nbsp;second(s)', this.timeout * 1000);

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
    this.websocket.send(JSON.stringify({ 'id': id, 'action': 'perform', 'method': action, 'params': JSON.stringify(params) }));
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

