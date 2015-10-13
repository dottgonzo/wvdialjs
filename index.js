var exec = require('promised-exec'),
verb=require('verbo'),
Promise=require('promise'),
providers=require('./providers.json');


// modprobe usbserial
// wvdialconf
// wvdial Defaults 1>/dev/null 2>/dev/null

function setstring(configFilePath,key,val){

  return new Promise(function (resolve, reject) {
getstring(configFilePath,key).then(function(oldstring){


  exec('sed -i -e "s/'+key[0].toUpperCase() + key.slice(1)+' = '+oldstring.replace(/\'/g, '\\"')+'/'+key[0].toUpperCase() + key.slice(1)+' = '+val.replace(/\"/g, '\\"')+'/g" '+configFilePath+'').then(function(stdout){

    resolve({success:true})

  }).catch(function(err){
    reject({error:err})
    verb('error',"error","getstring")

  })

}).catch(function(err){
    reject({error:err})
    verb('error',"error","getstring")

  })




})
}
function getstring(configFilePath,param){
  return new Promise(function (resolve, reject) {
allstrings(configFilePath).then(function(data){
  test=false;
  for(var i=0;i<Object.keys(data).length;i++){


    if(Object.keys(data)[i]==(param[0].toUpperCase() + param.slice(1))){

  test=true;
  resolve(data[Object.keys(data)[i]]);
    }
  }

  if(!test){

    reject({error:"wrong param"})

  }


}).catch(function(err){
  reject({error:err})

})

})
}
function allstrings(configFilePath){
  return new Promise(function (resolve, reject) {

  exec(__dirname+'/wvdial.sh  -t "get" -c"'+configFilePath+'"').then(function(data){
    resolve(JSON.parse(data))
  }).catch(function(err){
    reject(err)
  })
  })
}

function connect(configFilePath){
exec('modprobe usbserial&&wvdial Defaults -C '+configFilePath+' 1>/dev/null 2>/dev/null')
setTimeout(function () {

  exec('ip route add default dev ppp0 '+configFilePath)


}, 30000);
}

    function Wvdial(configFilePath,device) {
      this.configFilePath = configFilePath; // /etc/wvdial.conf
      this.device = device; // /dev/ttyUSB0 or 2-1.2
    }
    Wvdial.prototype.connect=function(){
      connect(this.configFilePath)
    },
    Wvdial.prototype.setUsb=function(connect){
      var configFilePath = this.configFilePath;

if( this.device && pathExist.sync(this.device)){
  return setstring(this.configFilePath,'Modem',this.device)


}

    },
    Wvdial.prototype.setProvider=function(provider){
      var configFilePath = this.configFilePath;

      return new Promise(function (resolve, reject) {
if(provider.apn){
  setstring(configFilePath,'Init3','"AT+CGDCONT=1","ip","'+provider.apn+'",,0,0').then(function(){
    console.log('ok apn')
    if(provider.phone){
      setstring(configFilePath,'Phone',provider.phone)
    }
    if(provider.username){
      setstring(configFilePath,'Username',provider.username)
    }
    if(provider.password){
      setstring(configFilePath,'Password',provider.password)
    }
    resolve({success:true})
  })


} else{
  reject('Must provide tty',"error","set provider with no apn")

}


  })

    },
    Wvdial.prototype.getConfig=function(){
return allstrings(this.configFilePath)



    },
      Wvdial.prototype.setParam=function(key,val){
return setstring(this.configFilePath,key,val)



    },
    Wvdial.prototype.getParam=function(param){
return getstring(this.configFilePath,param)



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

    Wvdial.prototype.setConfig=function(connect){
var device=this.device;
var configFilePath=this.configFilePath;
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

      exec(__dirname+'/wvdial.sh  -t "set" -c"'+configFilePath+'" -a"'+j.apn+'" -p"'+j.password+'" -u "'+j.user+'" -n "'+j.number+'" -y').then(function(stdout) {
    resolve(JSON.parse(stdout));
    if(connect){
      connect(configFilePath);
    }
  });
    }
  }

  })
};


module.exports=Wvdial
