var verb=require('verbo');
var Wv=require('../index.js');
var wvdialjs=new Wv('/etc/wvdial.conf');




wvdialjs.connect(true,"1-1.4").then(function(){
  verb('ok','info','connection')

}).catch(function(err){


  verb(err,'error','connection')
});
