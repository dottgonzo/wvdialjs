var exec = require('promised-exec'),
Promise=require('promise'),
waitfor=require('waitfor-promise'),
pathExists = require('path-exists'),
//spawn = require('child_process').spawn,
netw= require('netw'),
providers=require('./providers.json');


// modprobe usbserial
// wvdialconf
// wvdial Defaults 1>/dev/null 2>/dev/null

function setstring(configFilePath,key,val){

  return new Promise(function (resolve, reject) {
    getstring(configFilePath,key).then(function(oldstring){



      exec('sed -i -e "s/'+key[0].toUpperCase() + key.slice(1)+' = '+oldstring.replace(/\'/g, '\\"').replace(/\//g,'\\\/')+'/'+key[0].toUpperCase() + key.slice(1)+' = '+val.replace(/\"/g, '\\"').replace(/\//g,'\\\/')+'/g" '+configFilePath+'').then(function(stdout){

        resolve({success:true})

      }).catch(function(err){
        reject({error:err})


      })

    }).catch(function(err){
      reject({error:err})


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
  return new Promise(function (resolve, reject) {

console.log(configFilePath)
exec('pkill wvdial && sleep 5 ; modprobe usbserial').then(function(){
  exec('wvdial Defaults -C '+configFilePath+' 1>/dev/null 2>/dev/null &')
}).catch(function(){
  exec('wvdial Defaults -C '+configFilePath+' 1>/dev/null 2>/dev/null &')
})
    console.log('continue')

      var fun=function(){
        return new Promise(function (resolve, reject) {

        console.log('fun')

        netw().then(function(n){
          console.log('netw')

          var dev=false
          var ip=false;
  for(ns=0;ns<n.networks.length;ns++){
    if(n.networks[ns].interface=='ppp0'&&n.networks[ns].ip){
      ip=n.networks[ns].ip;
    }
  }
          if(ip){
            exec('ip route add default dev ppp0')

              resolve(true)


    
          } else{
            reject('error')
          }
        }).catch(function(err){
          verb(err,'error','Wvdialjs netwerr')
          reject(err)

        })
      })


      }

      waitfor.post(fun,{
        time:3000,
        timeout:180000
      }).then(function(answer){
        resolve(answer)

      }).catch(function(err){
        verb(err,'error','Wvdialjs waitfor')
        reject(err)

      })





  // setTimeout(function () {
  //   exec('ip route add default dev ppp0')
  // }, 30000);


    })
}

function Wvdial(configFilePath) {
  if(configFilePath){
    this.configFilePath = configFilePath; // /etc/wvdial.conf

  } else{
    this.configFilePath = '/etc/wvdial.conf'

  }
}
Wvdial.prototype.connect=function(){
  var configFilePath = this.configFilePath;

  return new Promise(function (resolve, reject) {
console.log('connetctio')

  getstring(configFilePath,'Modem').then(function(data){
    if(pathExists.sync(data)){
connect(configFilePath).then(function(answer){
  resolve(answer)

}).catch(function(err){
  reject(err)

})
    } else{
      reject('no file')

    }
  }).catch(function(){
    reject('err1')

  })


  })



},
Wvdial.prototype.setUsb=function(device){
  var configFilePath = this.configFilePath;
  return new Promise(function (resolve, reject) {

  if( device){
    setstring(configFilePath,'Modem',device.replace(/\//g,'\\\/')).then(function(){
      resolve({success:true})
    }).catch(function(err){
      reject(err)

    })


  } else{
    reject({error:"No device "+device+" founded"})

  }
})
},
Wvdial.prototype.setProvider=function(provider){
  var configFilePath = this.configFilePath;

  return new Promise(function (resolve, reject) {
    if(provider.apn){
      setstring(configFilePath,'Init3','AT+CGDCONT=1,"ip","'+provider.apn+'",,0,0').then(function(){
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

Wvdial.prototype.configure=function(provider){
  var configFilePath=this.configFilePath;
if(provider){


  return new Promise(function (resolve, reject) {

    exec('echo "[Dialer Defaults]" > '+configFilePath).then(function(){
      exec('echo \'Init3 = AT+CGDCONT=1,"ip","'+provider.apn+'",,0,0\' >> '+configFilePath).then(function(){
        exec('echo "Phone = '+provider.phone+'" >> '+configFilePath).then(function(){
          exec('echo "Username = '+provider.username+'" >> '+configFilePath).then(function(){
            exec('echo "Password = '+provider.password+'" >> '+configFilePath).then(function(){

              exec('wvdialconf '+configFilePath).then(function(){
                resolve({success:true});
}).catch(function(err){
  reject({error:'error on modem '})

})
            })
          })
        })
      })

    }).catch(function(err){
      reject({error:'error on open '+configFilePath})

    })


  })
} else{
  reject({error:'must push a provider'})

}
};


module.exports=Wvdial
