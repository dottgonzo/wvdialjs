var verb=require('verbo');
var Wv=require('../index.js');
var wvdialjs=new Wv('/etc/wvdial.conf');




wvdialjs.connect(true).catch(function(err){


  verb(err,'error','connection')
});
