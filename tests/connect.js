var verb=require('verbo'),
Wv=require('../index.js');
var wvdialjs=new Wv('/etc/wvdial.conf');



wvdialjs.connect().then(function(){

}).catch(function(err){
  verb("connection error","error","error")
})
