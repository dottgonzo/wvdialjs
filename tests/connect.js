var verb=require('verbo'),
Wv=require('../index.js'),
wvdialjs=new Wv('/etc/wvdial.conf'),
isOnline = require('is-online'),
timerdaemon=require('timerdaemon');



wvdialjs.connect()

timerdaemon.post(5000,function(){
  isOnline(function(err, online) {
      verb(online);
      //=> true
  });

})
