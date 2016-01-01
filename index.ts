import * as Promise from "bluebird";
import * as pathExists from "path-exists";
let exec = require('promised-exec');
let verb = require('verbo');
//spawn = require('child_process').spawn,
let waitfor = require('waitfor-promise');
let netw = require("netw");
let providers = require('./providers.json');


// modprobe usbserial
// wvdialconf
// wvdial Defaults 1>/dev/null 2>/dev/null

function setstring(configFilePath: string, key, val) {

    return new Promise(function(resolve, reject) {
        getstring(configFilePath, key).then(function(oldstring: string) {
            exec('sed -i -e "s/' + key[0].toUpperCase() + key.slice(1) + ' = ' + oldstring.replace(/\'/g, '\\"').replace(/\//g, '\\\/') + '/' + key[0].toUpperCase() + key.slice(1) + ' = ' + val.replace(/\"/g, '\\"').replace(/\//g, '\\\/') + '/g" ' + configFilePath + '').then(function(stdout) {
                resolve({ success: true })
            }).catch(function(err) {
                reject({ error: err })
            })
        }).catch(function(err) {
            reject({ error: err })
        })
    })
}
function getstring(configFilePath: string, param) {
    return new Promise(function(resolve, reject) {
        allstrings(configFilePath).then(function(data) {
            let test = false;
            for (var i = 0; i < Object.keys(data).length; i++) {
                if (Object.keys(data)[i] == (param[0].toUpperCase() + param.slice(1))) {
                    test = true;
                    resolve(data[Object.keys(data)[i]]);
                }
            }
            if (!test) {
                reject({ error: "wrong param" })
            }
        }).catch(function(err) {
            reject({ error: err })
        })
    })
}
function allstrings(configFilePath: string) {
    return new Promise(function(resolve, reject) {

        exec(__dirname + '/wvdial.sh  -t "get" -c"' + configFilePath + '"').then(function(data) {
            resolve(JSON.parse(data))
        }).catch(function(err) {
            reject(err)
        })
    })
}

function connect(configFilePath: string) {
    return new Promise(function(resolve, reject) {

        console.log(configFilePath)
        exec('pkill wvdial && sleep 5 ; modprobe usbserial').then(function() {
            exec('wvdial Defaults -C ' + configFilePath + ' 1>/dev/null 2>/dev/null &')
        }).catch(function() {
            exec('wvdial Defaults -C ' + configFilePath + ' 1>/dev/null 2>/dev/null &')
        })


        var fun = function() {
            return new Promise(function(resolve, reject) {

                verb('check connection', 'debug', 'wvdialjs')

                netw().then(function(n) {


                    var dev = false
                    var ip = false;
                    for (let ns = 0; ns < n.networks.length; ns++) {
                        if (n.networks[ns].interface == 'ppp0' && n.networks[ns].ip) {
                            ip = n.networks[ns].ip;
                            dev = n.networks[ns].interface
                        }
                    }
                    if (ip) {
                        console.log("set default route")
                        exec('ip route add default dev ppp0')

                        resolve(true)



                    } else {
                        reject('error')
                    }
                }).catch(function(err) {
                    verb(err, 'error', 'Wvdialjs netwerr')
                    reject(err)

                })
            })


        }

        waitfor.post(fun, {
            time: 20000,
            timeout: 240000
        }).then(function(answer) {
            resolve(answer)

        }).catch(function(err) {
            verb(err, 'error', 'Wvdialjs waitfor')
            reject(err)

        })

        // setTimeout(function () {
        //   exec('ip route add default dev ppp0')
        // }, 30000);


    })
}


export =class WvDial {
    configFilePath: string;
    constructor(public path: string) {
        if (path) {
            this.configFilePath = path; // /etc/wvdial.conf
        } else {
            this.configFilePath = '/etc/wvdial.conf'
        }
    };

    connect = function() {
        var configFilePath = this.configFilePath;

        return new Promise(function(resolve, reject) {
            console.log('connetctio')

            getstring(configFilePath, 'Modem').then(function() {
                connect(configFilePath).then(function(answer) {
                    resolve(answer)
                }).catch(function(err) {
                    reject(err)
                })
            }).catch(function() {
                reject('err1')
            })
        })
    };

    setUsb = function(device: string) {
        var configFilePath = this.configFilePath;
        return new Promise(function(resolve, reject) {

            if (device) {
                setstring(configFilePath, 'Modem', device.replace(/\//g, '\\\/')).then(function() {
                    resolve({ success: true })
                }).catch(function(err) {
                    reject(err)

                })


            } else {
                reject({ error: "No device " + device + " founded" })

            }
        })
    };

    setProvider = function(provider: { apn: string, phone?: string, username?: string, password?: string }) {
        var configFilePath = this.configFilePath;

        return new Promise(function(resolve, reject) {
            if (provider.apn) {
                setstring(configFilePath, 'Init3', 'AT+CGDCONT=1,"ip","' + provider.apn + '",,0,0').then(function() {
                    console.log('ok apn')
                    if (provider.phone) {
                        setstring(configFilePath, 'Phone', provider.phone)
                    }
                    if (provider.username) {
                        setstring(configFilePath, 'Username', provider.username)
                    }
                    if (provider.password) {
                        setstring(configFilePath, 'Password', provider.password)
                    }
                    resolve({ success: true })
                })
            } else {
                reject("no apn")
            }
        })

    };

    getConfig = function() {
        return allstrings(this.configFilePath)
    };

    setParam = function(key, val) {
        return setstring(this.configFilePath, key, val)
    };

    getParam = function(param) {
        return getstring(this.configFilePath, param)
    };

    getProviders = function() {
        return providers;
    };

    getProvidersFrom = function(country) {
        return new Promise(function(resolve, reject) {

            if (!country) {
                reject('Must provide a country')
            } else {
                var prov = [];
                for (var i = 0; i < providers.length; i++) {
                    if (providers[i].country.toLowerCase() == country.toLowerCase()) {
                        prov.push(providers[i].providers)
                    }
                }
                if (prov.length > 0) {
                    resolve(prov);
                } else {
                    reject('No providers for ' + country)
                }
            }
        })
    };

    configure = function(provider) {
        var configFilePath = this.configFilePath;
        return new Promise(function(resolve, reject) {
            if (provider) {
                exec('echo "[Dialer Defaults]" > ' + configFilePath).then(function() {
                    exec('echo \'Init3 = AT+CGDCONT=1,"ip","' + provider.apn + '",,0,0\' >> ' + configFilePath).then(function() {
                        exec('echo "Phone = ' + provider.phone + '" >> ' + configFilePath).then(function() {
                            exec('echo "Username = ' + provider.username + '" >> ' + configFilePath).then(function() {
                                exec('echo "Password = ' + provider.password + '" >> ' + configFilePath).then(function() {
                                    exec('wvdialconf ' + configFilePath).then(function() {
                                        resolve({ success: true });
                                    }).catch(function(err) {
                                        reject({ error: 'error on modem ' })
                                    })
                                })
                            })
                        })
                    })

                }).catch(function(err) {
                    reject({ error: 'error on open ' + configFilePath })

                })



            } else {
                reject({ error: 'must push a provider' })

            }
        })
    };


};
