var verb=require('verbo'),
Wv=require('../index.js'),
wvdialjs=new Wv('/etc/wvdial.conf'),
netw= require('netw'),
timerdaemon=require('timerdaemon');



wvdialjs.connect()

timerdaemon.post(5000,function(){
  netw.data().then(function(doc){
    if (doc.network){
    verb("connected to "+doc.network.dev+' with '+doc.network.ip,"info","Online")
  } else{
    verb("Offline","warning","Offline")

  }

  })


})
