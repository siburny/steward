require('x509-keygen').x509_keygen({ subject    : '/CN=steward'
                                   , keyfile    : '../../steward/db/server.key'
                                   , certfile   : '../../steward/sandbox/server.crt'
                                   , sha1file   : '../../steward/sandbox/server.sha1'
                                   , alternates : [ 'DNS:' + require('os').hostname(), 'DNS:steward.local' ]
                                   , destroy    : false }, function(err, data) {
  if (err) return console.log('keypair generation error: ' + err.message);

  console.log('keypair generated.');
});