let verb=require('verbo');
import Wv from '../index';


let config={
    configFilePath:'/etc/wvdial.conf',
    provider:{"label":"Tre Ricaricabile","apn":"tre.it","phone":"*99#","username":"tre","password":"tre"},
    device:"1-1.4"
}

let wvdialjs=new Wv(config);


wvdialjs.configure().then(function(data){
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



