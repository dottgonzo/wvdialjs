var verb=require('verbo'),
Wv=require('../index.js');
var wvdialjs=new Wv('/etc/wvdial.conf');
verb(JSON.stringify(wvdialjs.getProviders()),"info","providers");
wvdialjs.getConfig().then(function(data){
  verb(JSON.stringify(data),"info","config")

});
wvdialjs.getParam('modem').then(function(data){
  verb(JSON.stringify(data),"info","password param")

}).catch(function(err){
  verb(err,"error","param")
});
wvdialjs.setParam('password','ffff').then(function(data){
  verb(JSON.stringify(data),"info","password set")

}).catch(function(err){
  verb(err,"error","set")
});
wvdialjs.setUsb('/dev/ttyUSB0').then(function(data){
  verb(JSON.stringify(data),"info","USB set")

}).catch(function(err){
  verb(JSON.stringify(err),"error","set USB")
});
wvdialjs.setProvider({"label":"Tre Ricaricabile","apn":"tre.it","phone":"*99#","username":"tre","password":"tre"}).then(function(data){
  verb(JSON.stringify(data),"info","setProvider")

}).catch(function(err){
  verb(err,"error","set")
});
//verb(JSON.stringify(wvdialjs.setProvider({"label":"Tre Ricaricabile","apn":"tre.it","number":"*99#","user":"tre","password":"tre"})),"info","config");


wvdialjs.getProvidersFrom('Italy').then(function(c){
  verb(JSON.stringify(c),"info","Wvdialjs")
}).catch(function(err){
verb('error','error','Wvdialjs')
process.exit(1);

})
