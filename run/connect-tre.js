var verb=require('verbo');
var Wv=require('../index.js');
var wvdialjs=new Wv('/etc/wvdial.conf');




wvdialjs.connect().then(function(){
  verb('ok','info','connection')

}).catch(function(err){


  verb(err,'error','connection')
});
