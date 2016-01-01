var verb=require('verbo'),
Wv=require('../index.js'),
wvdialjs=new Wv('/etc/wvdial.conf'),
netw= require('netw');


wvdialjs.connect().then(function(){
  verb('ok','info','connection')

  netw().then(function(answer){
    verb(answer)
  })
}).catch(function(err){


  verb(err,'error','connection')
});
