var verb=require('verbo'),
Wv=require('../index.js');
var wvdialjs=new Wv('/etc/wvdial.conf');



wvdialjs.configure({"label":"TIM Ricaricabile","apn":"wap.tim.it","phone":"*99#ff","username":"tim","password":"tim"}).then(function(data){
verb(JSON.stringify(data))
}).catch(function(err){
  verb(JSON.stringify(err),"error","error")
})
