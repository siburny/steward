var db = require('../api/api-manage-user').db,
  util = require('util'),
  devices = require('./device');

var model = {
  getAccessToken: function (bearerToken, callback) {
    db.all('SELECT access_token, client_id, expires, user_id FROM oauth_access_tokens WHERE access_token = ?', [bearerToken], function (err, result) {
      if (err) return callback(err);
      if (!result) return callback();

      var token = result[0];
      callback(null, {
        accessToken: token.access_token,
        clientId: token.client_id,
        expires: token.expires,
        userId: token.user_id
      });
    });
  },

  getAuthCode: function (authorizationCode, callback) {
    db.all('SELECT client_id, expires, user_id FROM oauth_authorization_codes WHERE authorization_code = ?', [authorizationCode], function (err, result) {
      if (err) return callback(err);
      if (!result) return callback();

      var token = result[0];
      callback(null, {
        clientId: token.client_id,
        expires: token.expires,
        userId: token.user_id
      });
    });
  },

  getClient: function (clientId, clientSecret, callback) {
    db.all('SELECT client_id, client_secret, redirect_uri FROM oauth_clients WHERE client_id = ?', [clientId], function (err, result) {
      if (err) return callback(err);
      if (!result) return callback();

      var client = result[0];
      if (clientSecret !== null && client.client_secret !== clientSecret) return callback();

      callback(null, {
        clientId: client.client_id,
        clientSecret: client.client_secret,
        redirectUri: client.redirect_uri
      });
    });
  },

  getRefreshToken: function (bearerToken, callback) {
    db.all('SELECT refresh_token, client_id, expires, user_id FROM oauth_refresh_tokens WHERE refresh_token = ?', [bearerToken], function (err, result) {
      callback(err, !!result ? result[0] : false);
    });
  },

  saveAuthCode: function (authCode, clientId, expires, userId, callback) {
    db.run('INSERT INTO oauth_authorization_codes(authorization_code, client_id, user_id, expires) VALUES (?, ?, ?, ?)',
      [authCode, clientId, userId, expires], callback);
  },

  saveAccessToken: function (accessToken, clientId, expires, user, callback) {
    db.run('INSERT INTO oauth_access_tokens(access_token, client_id, user_id, expires) VALUES (?, ?, ?, ?)',
      [accessToken, clientId, user.id, expires], callback);
  },

  saveRefreshToken: function (refreshToken, clientId, expires, user, callback) {
    db.run('INSERT INTO oauth_refresh_tokens(refresh_token, client_id, user_id, expires) VALUES (?, ?, ?, ?)',
      [refreshToken, clientId, user.id, expires], callback);
  },

  grantTypeAllowed: function(clientId, grantType, callback) {
    callback(null, true);
  }

};

exports.start = function (app, api) {
  const OAuth2Server = require('node-oauth2-server');
  var oauth = new OAuth2Server({
    model: model,
    grants: ['authorization_code', 'refresh_token']
  });

  // Get login.
  app.get('/login', function (req, res) {
    res.render('login', {
      redirect: encodeURIComponent(req.query.redirect),
      client_id: req.query.client_id,
      redirect_uri: encodeURIComponent(req.query.redirect_uri),
      state: req.query.state
    })
  });

  // Post login.
  app.post('/login', function (req, res) {
    console.log('/login ', req.body);
    let user = true;
    if (!user) {
      console.log('not a user', user);
      return login(req, res);
    }

    req.session.user = { id: 111 };

    console.log('logging in ', user);

    let path = decodeURIComponent(req.body.redirect) || '/home';
    res.redirect(util.format('%s?client_id=%s&redirect_uri=%s&state=%s&response_type=code', path, req.body.client_id, req.body.redirect_uri, req.body.state));
  });

  app.get('/cloud/auth', function (req, res, next) {
    if (!req.session.user) {
      return res.redirect('/login?redirect=' + req.path + '&client_id=' + req.query.client_id +
        '&redirect_uri=' + req.query.redirect_uri + '&state=' + req.query.state);
    }
    next();
  }, oauth.authCodeGrant(function (req, next) {
    next(null, true, req.session.user.id);
  }));

  app.all('/cloud/token', oauth.grant());

  let googleSmartHome = require('./actions-smarthome');
  app.all('/cloud/endpoint', oauth.authorise(), googleSmartHome.handler);

  return oauth;
}
