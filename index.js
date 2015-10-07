var exec = require('child_process').exec,
verb=require('verbo'),
Promise=require('promise'),
providers=require('./providers.json');


// modprobe usbserial
// wvdialconf
// wvdial Defaults 1>/dev/null 2>/dev/null


(function() {
  var Wvdial;



  Wvdial = (function() {
    function Wvdial(device,configFile) {
      this.configFile = configFile;
      this.device = device;
    }

    Wvdial.prototype.getdevices = function() {


// get all devices

    };

    Wvdial.prototype.set=function(j){


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

      exec(__dirname+'/wvdial.sh  -t "set" -a"'+j.apn+'" -p"'+j.password+'" -u "'+j.user+'" -n "'+j.number+'" -y',function(err, stdout, stderr) {
    resolve(stdout);
  });
    }
  }

  })
};









    Wvdial.prototype.query = function(query, callback) {
      var queryURL;
      if (this.appId == null) {
        throw new Error("Cannot query without appId.");
      }
      queryURL = this.makeQueryURL(query);
      return request(queryURL, function(err, response, body) {
        if ((err != null) || response.statusCode !== 200) {
          return callback(err, null);
        }
        return xml2js.parseString(body, function(err, result) {
          if (err != null) {
            return callback(err, result);
          } else if (result.queryresult.$.error) {
            return callback(result.queryresult.error, result);
          } else {
            return callback(null, result);
          }
        });
      });
    };

    return Wvdial;

  })();

  module.exports = Wvdial;

}).call(this);





















module.exports={
  set:function(j){


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

    exec(__dirname+'/wvdial.sh  -t "set" -a"'+j.apn+'" -p"'+j.password+'" -u "'+j.user+'" -n "'+j.number+'" -y',function(err, stdout, stderr) {
  resolve(stdout);
});
  }
}

})
  },
  get:function(){

  },

  validate:function(){



  },
  providers:function(){
    return providers;
  },
  providersfrom:function(country){
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
  }
}
