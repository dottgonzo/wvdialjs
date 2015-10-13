var verb=require('verbo'),
Wv=require('../index.js'),
wvdialjs=new Wv('/etc/wvdial.conf'),
isOnline = require('is-online'),
netw= require('netw'),
timerdaemon=require('timerdaemon');



wvdialjs.connect()

timerdaemon.post(5000,function(){
  netw.data().then(function(doc){
    console.log(doc.network)
  })
  isOnline(function(err, online) {
      verb(online);
      //=> true
  });

})
