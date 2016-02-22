import * as Promise from "bluebird";
import * as pathExists from "path-exists";
let exec = require('promised-exec');
let verb = require('verbo');
//spawn = require('child_process').spawn,
let waitfor = require('waitfor-promise');
let netw = require("netw");



interface IProvider {
    
                label:string;
            apn:string;
            phone:string;
            username:string;
            password:string;
    
}


// modprobe usbserial
// wvdialconf
// wvdial Defaults 1>/dev/null 2>/dev/null

function setstring(configFilePath: string, key, val) {

    return new Promise<{success?:boolean}>(function(resolve, reject) {
        getstring(configFilePath, key).then(function(oldstring: string) {
            exec('sed -i -e "s/' + key[0].toUpperCase() + key.slice(1) + ' = ' + oldstring.replace(/\'/g, '\\"').replace(/\//g, '\\\/') + '/' + key[0].toUpperCase() + key.slice(1) + ' = ' + val.replace(/\"/g, '\\"').replace(/\//g, '\\\/') + '/g" ' + configFilePath + '').then(function(stdout) {
                resolve({ success: true });
            }).catch(function(err) {
                reject({ error: err });
            });
        }).catch(function(err) {
            reject({ error: err });
        });
    });
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
                reject({ error: "wrong param" });
            }
        }).catch(function(err) {
            reject({ error: err });
        })
    })
}
function allstrings(configFilePath: string) {
    return new Promise(function(resolve, reject) {

        exec(__dirname + '/wvdial.sh  -t "get" -c"' + configFilePath + '"').then(function(data) {
            resolve(JSON.parse(data));
        }).catch(function(err) {
            reject(err);
        })
    })
}

function connect(configFilePath: string) {
    return new Promise<boolean>(function(resolve, reject) {

        console.log(configFilePath)
        exec('pkill wvdial && sleep 5 ; modprobe usbserial').then(function() {
            exec('wvdial Defaults -C ' + configFilePath + ' 1>/dev/null 2>/dev/null &');
        }).catch(function() {
            exec('wvdial Defaults -C ' + configFilePath + ' 1>/dev/null 2>/dev/null &');
        })


        let fun = function() {
            return new Promise(function(resolve, reject) {

                verb('check connection', 'debug', 'wvdialjs');

                netw().then(function(n) {


                    let dev = false
                    let ip = false;
                    for (let ns = 0; ns < n.networks.length; ns++) {
                        if (n.networks[ns].interface == 'ppp0' && n.networks[ns].ip) {
                            ip = n.networks[ns].ip;
                            dev = n.networks[ns].interface;
                        }
                    }
                    if (ip) {
                        console.log("set default route");
                        exec('ip route add default dev ppp0');

                        resolve(true);



                    } else {
                        reject('error');
                    }
                }).catch(function(err) {
                    verb(err, 'error', 'Wvdialjs netwerr');
                    reject(err);

                })
            })


        }

        waitfor.post(fun, {
            time: 20000,
            timeout: 240000
        }).then(function(answer) {
            resolve(answer);

        }).catch(function(err) {
            verb(err, 'error', 'Wvdialjs waitfor');
            reject(err);

        });

        // setTimeout(function () {
        //   exec('ip route add default dev ppp0')
        // }, 30000);


    })
}


export =class WvDial {
    configFilePath: string;
    provider:string;
    constructor(public path: string) {
        if (path) {
            this.configFilePath = path; // /etc/wvdial.conf
        } else {
            this.configFilePath = '/etc/wvdial.conf';
        }
    };

    connect() {
        let configFilePath = this.configFilePath;

        return new Promise<boolean>(function(resolve, reject) {
            console.log('connection');

            getstring(configFilePath, 'Modem').then(function() {
                connect(configFilePath).then(function(answer) {
                    resolve(answer);
                }).catch(function(err) {
                    reject(err);
                })
            }).catch(function() {
                reject('err1');
            });
        })
    };

    setUsb(device: string) {
        let configFilePath = this.configFilePath;
        return new Promise<{success?:boolean}>(function(resolve, reject) {

            if (device) {
                setstring(configFilePath, 'Modem', device.replace(/\//g, '\\\/')).then(function() {
                    resolve({ success: true });
                }).catch(function(err) {
                    reject(err);

                });


            } else {
                reject({ error: "No device " + device + " founded" });

            }
        })
    };

    setProvider(provider: IProvider) {
        let configFilePath = this.configFilePath;

        return new Promise<{success?:boolean}>(function(resolve, reject) {
            if (provider.apn) {
                setstring(configFilePath, 'Init3', 'AT+CGDCONT=1,"ip","' + provider.apn + '",,0,0').then(function() {
                    console.log('ok apn');
                    if (provider.phone) {
                        setstring(configFilePath, 'Phone', provider.phone);
                    }
                    if (provider.username) {
                        setstring(configFilePath, 'Username', provider.username);
                    }
                    if (provider.password) {
                        setstring(configFilePath, 'Password', provider.password);
                    }
                    resolve({ success: true });
                })
            } else {
                reject("no apn");
            }
        })

    };

    getConfig() {
        return allstrings(this.configFilePath);
    };

    setParam(key, val) {
        return setstring(this.configFilePath, key, val);
    };

    getParam(param) {
        return getstring(this.configFilePath, param);
    };



    configure(provider) {
        let configFilePath = this.configFilePath;
        return new Promise<{success?:boolean}>(function(resolve, reject) {
            if (provider) {
                exec('echo "[Dialer Defaults]" > ' + configFilePath).then(function() {
                    exec('echo \'Init3 = AT+CGDCONT=1,"ip","' + provider.apn + '",,0,0\' >> ' + configFilePath).then(function() {
                        exec('echo "Phone = ' + provider.phone + '" >> ' + configFilePath).then(function() {
                            exec('echo "Username = ' + provider.username + '" >> ' + configFilePath).then(function() {
                                exec('echo "Password = ' + provider.password + '" >> ' + configFilePath).then(function() {
                                    exec('wvdialconf ' + configFilePath).then(function() {
                                        resolve({ success: true });
                                    }).catch(function(err) {
                                        reject({ error: 'error on modem ' });
                                    })
                                })
                            })
                        })
                    })

                }).catch(function(err) {
                    reject({ error: 'error on open ' + configFilePath });

                });



            } else {
                reject({ error: 'must push a provider' });

            }
        })
    };


};
