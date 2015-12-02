var verb=require('verbo'),
Wv=require('../index.js'),
wvdialjs=new Wv('/etc/wvdial.conf'),
netw= require('netw');


wvdialjs.connect().then(function(){
  netw().then(function(answer){
    verb(answer)
  })
});
