var verb=require('verbo'),
Wv=require('../index.js');
var wvdialjs=new Wv('/etc/wvdial.conf');



wvdialjs.configure({"label":"Tre Ricaricabile","apn":"tre.it","phone":"*99#","username":"tre","password":"tre"}).then(function(data){
verb(JSON.stringify(data))
}).catch(function(err){
  verb(JSON.stringify(err),"error","error")
})
