var verb=require('verbo'),
Wv=require('../index.js');
var wvdialjs=new Wv();
verb(JSON.stringify(wvdialjs.getProviders()),"info","Wvdialjs");


wvdialjs.getProvidersFrom('Italy').then(function(c){
  verb(JSON.stringify(c),"info","Wvdialjs")
}).catch(function(err){
verb('error','error','Wvdialjs')
process.exit(1);

})
