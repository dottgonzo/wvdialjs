let verb=require('verbo');
import Wv=require('../index');
let wvdialjs=new Wv('/etc/wvdial.conf',"1-1.4");


wvdialjs.configure({"label":"Tre Ricaricabile","apn":"tre.it","phone":"*99#","username":"tre","password":"tre"}).then(function(data){
wvdialjs.connect(true).then(function(){
  verb('ok','info','connection')

}).catch(function(err){


  verb(err,'error','connection')
});
setTimeout(function(){
    
   console.log(wvdialjs.status()) 
    
},240000)
}).catch(function(err){
  verb(err,"error","error")
})



