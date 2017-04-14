var api = new API();

var grid = null;
function initGrid() {
  if(!!grid) {
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

$(function() {
  api.connect();

  $(".button-collapse").sideNav();

  $(window).resize(function() {
    var width = $(document).width();
    var newsize = 0;	
    if(width > 1200) {
      newsize = 12;
    } else if(width > 992) {
      newsize = 10;
    } else if(width > 600) {
      newsize = 6;
    } else {
      newsize = 4;
    }
    
    grid.gridList('resize', newsize);
  });

  initGrid();
});

function API() { 
  this.websocket = null;
  this.timeout = 5;
}
API.prototype.connect = function() {
  var self = this;
  
  this.websocket = new WebSocket('ws://localhost:8000/api/');
  this.websocket.onopen = function(evt) { 
    self.timeout = 5;
    Materialize.toast('Connected.', 2000);

    setTimeout(function() {
      self.websocket.send(JSON.stringify({'action': 'loadDevices'}));
    }, 500);
  };
  this.websocket.onclose = function(evt) {
    Materialize.toast('Connection closed.', 2000);
    self.reconnect();
  };
  this.websocket.onmessage = function onMessage(evt) {
    if(!!evt && !!evt.data) {
      var msg = JSON.parse(evt.data);

      $('#grid #device-'+msg.id).remove();
      $('#grid').append(msg.html);
      
      initGrid();
    }
  }
  this.websocket.onerror = function(evt) {
    Materialize.toast('Error connecting. Retrying ... ', 2000);

    self.timeout *= 2;
    if(self.timeout > 60) {
      self.timeout = 60;
    }
  };
}
API.prototype.close = function() {
  if(!!this.websocket) {
    this.websocket.close();
  }
  this.websocket = null;
}
API.prototype.reconnect = function() {
  Materialize.toast('Connecting in&nbsp;<span id="RetryTimeout">' + this.timeout + '</span>&nbsp;second(s)', this.timeout * 1000);
  
  var timeout = this.timeout;
  var interval = setInterval(function() {
    if(--timeout <= 0) {
      clearInterval(interval);
    } else {
      $('#RetryTimeout').text(timeout);
    }
  }, 1000)

  this.close();
  var self = this;
  setTimeout(function() {
    self.connect();
  }, this.timeout * 1000);
}



