var verb=require('verbo'),
wvdialjs=require('../index.js');

verb(JSON.stringify(wvdialjs.getall()),"info","Wvdialjs");


wvdialjs.getparams('Italy').then(function(c){
  verb(JSON.stringify(c),"info","Wvdialjs")
}).catch(function(err){
verb('error','error','Wvdialjs')
process.exit(1);

})
