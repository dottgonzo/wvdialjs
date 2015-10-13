var exec = require('promised-exec'),
verb=require('verbo'),
Promise=require('promise'),
providers=require('./providers.json');


// modprobe usbserial
// wvdialconf
// wvdial Defaults 1>/dev/null 2>/dev/null


function connect(configFile){
exec('modprobe usbserial&&wvdial -C '+configFile)
setTimeout(function () {

  exec('ip route add default dev ppp0 '+configFile)


}, 30000);
}

    function Wvdial(device,configFile) {
      this.configFile = configFile; // /etc/wvdial.conf
      this.device = device; // /dev/ttyUSB0
    }
    Wvdial.prototype.connect=function(){
      connect(this.configFile)
    },
    Wvdial.prototype.setUsb=function(connect){
      var configFile = this.configFile;

if( this.device && pathExist.sync(this.device)){
  exec('sed -i -e "s/$(cat '+configFile+' | grep -v Type|grep Modem| sed \'s/\// /g\' | awk \'{print($4)}\')/'+this.device+' /g" '+configFile).then(function(){
if(connect){
  connect(configFile);
}
  })

}

    },
    Wvdial.prototype.setProviders=function(provider){
      this.provider=provider;


    },
Wvdial.prototype.getProviders=function(){
  return providers;
},
Wvdial.prototype.getProvidersFrom=function(country){
  return new Promise(function (resolve, reject) {

if(!country){
reject('Must provide a country')
verb('Must provide a country',"error","Wvdialjs")
} else{
var prov=[];
for(var i=0;i<providers.length;i++){
  if(providers[i].country.toLowerCase()==country.toLowerCase()){
prov.push(providers[i].providers)
  }
}

if(prov.length>0){
resolve(prov);
} else{
reject('No providers for '+country)
}

}


})
};

    Wvdial.prototype.configure=function(connect){
var device=this.device;
var configFile=this.configFile;
var j=this.provider;
    return new Promise(function (resolve, reject) {

  if (!j){
    reject('Must provide config')
  verb('Must provide a json for settings',"error","Wvdialjs")
  } else{
    if (!j.apn){
      reject('Must provide apn')
      verb('Must provide apn',"error","Wvdialjs")

    } else if(!j.tty){
      reject('Must provide tty')
      verb('Must provide tty',"error","Wvdialjs")
      } else{

      exec(__dirname+'/wvdial.sh  -t "set" -c"'+configFile+'" -a"'+j.apn+'" -p"'+j.password+'" -u "'+j.user+'" -n "'+j.number+'" -y').then(function(stdout) {
    resolve(JSON.parse(stdout));
    if(connect){
      connect(configFile);
    }
  });
    }
  }

  })
};


module.exports=Wvdial
