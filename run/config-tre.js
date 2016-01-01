var verb=require('verbo'),
Wv=require('../index.js');
var wvdialjs=new Wv('/etc/wvdial.conf');



wvdialjs.configure({"label":"Tre Ricaricabile","apn":"tre.it","phone":"*99#","username":"tre","password":"tre"}).then(function(data){
verb(data)
}).catch(function(err){
  verb(err,"error","error")
})
