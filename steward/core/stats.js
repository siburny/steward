var utility = require('./../core/utility');
var util = require('util');

var logger = exports.logger = utility.logger('stats');

exports.start = function () {
  var db = require('./database').db;

  if (!db) {
    logger.debug('database not ready, retrying...');
    setTimeout(exports.start, 1 * 100);
    return;
  }

  db.serialize(function() {
    db.run('CREATE TABLE IF NOT EXISTS stats('
      + 'statID INTEGER PRIMARY KEY ASC,'
      + 'whoami TEXT,'
      + 'whatami TEXT,'
      + 'status TEXT,'
      + 'updated TIMESTAMP'
      + ')');

    db.run('CREATE TABLE IF NOT EXISTS stats_props('
      + 'propID INTEGER PRIMARY KEY ASC,'
      + 'statID INTEGER,'
      + 'name TEXT,'
      + 'value TEXT'
      + ')');
  });

  utility.broker.subscribe('beacon-egress', function(category, data) {
    if(category == '.updates'){
      if(!Array.isArray(data))
      {
        data = [data];
      }

      for(var i in data)
      {
        var item = data[i];

        db.run("INSERT INTO stats (whoami, whatami, status, updated) VALUES ($whoami, $whatami, $status, $updated)", {$whoami: item.whoami, $whatami: item.whatami, $status: item.status, $updated: item.updated}, function(err) {
          if(!err) {
            var id = this.lastID;

            for(var key in item.info)
            {
              var value = item.info[key];
              if(typeof value !== 'undefined' && typeof value !== 'object' && !Array.isArray(value))
              {
                db.run("INSERT INTO stats_props (statID, name, value) VALUES ($statID, $name, $value)", {$statID: id, $name: key, $value: value});
              }
            }
          }
        });
      }
    }
  });
};

