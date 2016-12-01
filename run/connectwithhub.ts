let verb = require('verbo');
import Wv from '../index';


let config = {
  configFilePath: '/etc/wvdial.conf',
  provider: { "label": "Tre Ricaricabile", "apn": "tre.it", "phone": "*99#", "username": "tre", "password": "tre" },
  device: "3-1:1.0"
}

let wvdialjs = new Wv(config);


wvdialjs.configure(true).then(function (data) {
  console.log(data)
  wvdialjs.connect(true).then(function () {
    verb('ok', 'info', 'connection')
    setTimeout(function () {

      console.log(wvdialjs.status())

    }, 240000)
  }).catch(function (err) {


    verb(err, 'error', 'connection')
  });

}).catch(function (err) {
  verb(err, "error", "error")
})



