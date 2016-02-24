var verb=require('verbo');
var Wv=require('../index.js');
var wvdialjs=new Wv('/etc/wvdial.conf');


wvdialjs.configure({"label":"Tre Ricaricabile","apn":"tre.it","phone":"*99#","username":"tre","password":"tre"}).then(function(data){
wvdialjs.connect(true).catch(function(err){


  verb(err,'error','connection')
});
setTimeout(function(){
    
   console.log(wvdialjs.status()) 
    
},50000)
}).catch(function(err){
  verb(err,"error","error")
})





