import * as Promise from "bluebird";
import * as pathExists from "path-exists";
import * as fs from "fs";
import lsusbdev = require("lsusbdev");
let hwrestart = require('hwrestart');

let exec = require('promised-exec');
let Tail = require('always-tail');

let verb = require('verbo');

let mobilestatus = false;

//spawn = require('child_process').spawn,


interface IConfOpt {
    verbose?: boolean;
    dev?: any;
    provider: IProviderCF;
};


interface IProviderCF {

    label?: string;
    apn: string;
    phone?: string;
    username?: string;
    password?: string;

}
interface IProvider {

    label?: string;
    apn: string;
    phone: string;
    username: string;
    password: string;

}
// modprobe usbserial
// wvdialconf
// wvdial Defaults 1>/dev/null 2>/dev/null

function setstring(configFilePath: string, key, val) {

    return new Promise<{ success?: boolean }>(function(resolve, reject) {
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

function connect(configFilePath: string, watch?: boolean, device?: string) {
    return new Promise<boolean>(function(resolve, reject) {


        console.log(device)

        let exist = false;
        lsusbdev().then(function(data: [{ type: string, dev: string, product: string, hub: string, id: string }]) {
            for (var i = 0; i < data.length; i++) {
                var usb = data[i];
                if (usb.type == 'serial' && (device && usb.hub == device) || !device) {
                    exist = true;
                    console.log("pass1")
                }
            }

        })

        if (!exist) hwrestart("reboot")
        
        // check if wvdial.conf usb is present
        console.log(configFilePath)


        let wvdialerr = "/tmp/Wvdial.err"
        let wvdialout = "/tmp/Wvdial.out"

        let lncount = 0;

        function wvconnect() {
            mobilestatus = false;
            if (lncount > 200) {



                if (!watch) {
                    tail.unwatch();
                    reject(true);

                } else {
                    console.log("reboot")
                    hwrestart("unplug");
                }



            }
            if (device) {


                lsusbdev().then(function(data) {
                    let devto: any = false;
                    for (var i = 0; i < data.length; i++) {
                        var usb = data[i];


                        if (usb.type == 'serial' && usb.hub == device && !devto) {
                            console.log('set ' + usb.dev)


                            devto = usb.dev;


                        }
                    }


                    if (devto) {
                        setstring(configFilePath, 'Modem', devto).then(function() {



                            exec('pkill wvdial && sleep 5 ; modprobe usbserial').then(function() {
                                exec('sleep 5; wvdial Defaults -C ' + configFilePath + ' 1>' + wvdialerr + ' 2>' + wvdialout).catch(function() {
                                    lncount = lncount + 60
                                    wvconnect()
                                    console.log(lncount)
                                });
                            }).catch(function() {
                                exec('sleep 5; wvdial Defaults -C ' + configFilePath + ' 1>' + wvdialerr + ' 2>' + wvdialout).catch(function() {
                                    lncount = lncount + 60
                                    wvconnect()
                                    console.log(lncount)
                                });
                            });
                        }).catch(function(err) {


                            console.log(err + " set string error")
                            lncount = lncount + 30
                            wvconnect()
                            console.log(lncount)


                        });
                    } else {

                        console.log(" err2")
                        lncount = lncount + 30
                        wvconnect()
                        console.log(lncount)



                    }


                }).catch(function(err) {
                    lncount = lncount + 60
                    wvconnect()
                    console.log(lncount)

                });


            } else {

                exec('pkill wvdial && sleep 5 ; modprobe usbserial').then(function() {
                    exec('sleep 5; wvdial Defaults -C ' + configFilePath + ' 1>' + wvdialerr + ' 2>' + wvdialout).catch(function() {
                        lncount = lncount + 60
                        wvconnect()
                        console.log(lncount)
                    });
                }).catch(function() {
                    exec('sleep 5; wvdial Defaults -C ' + configFilePath + ' 1>' + wvdialerr + ' 2>' + wvdialout).catch(function() {
                        lncount = lncount + 60
                        wvconnect()
                        console.log(lncount)
                    });
                });

            }

        }

        fs.writeFileSync(wvdialerr, "");

        fs.writeFileSync(wvdialout, "");



        var tail = new Tail(wvdialout, '\n');

        tail.on('line', function(data) {

            lncount = lncount + 1;


            if (data.split("DNS").length == 2) {
        
                // setTimeout(function () {
                //   exec('ip route add default dev ppp0')
                // }, 30000);
                mobilestatus = true;

                fs.writeFileSync(wvdialerr, "");

                fs.writeFileSync(wvdialout, "");

                lncount = 0;

                console.log('ppp connected')

                //    if (!watch) {
                //        tail.unwatch();
                //       resolve(true);

                //    }



            } else if (lncount > 200) {
                mobilestatus = false;

                if (!watch) {
                    tail.unwatch();
                    reject(true);

                } else {
                    hwrestart("unplug");
                }





            }

        });


        tail.on('error', function(data) {
            console.log("tailerror");


            if (!watch) {
                tail.unwatch();
                reject(true);

            } else {
                hwrestart("unplug");
            }






        });

        tail.watch();

        wvconnect()









    })
}


function setprov(configFilePath, provider: IProviderCF) {




    if (!provider.phone) provider.phone = '*99#';
    if (!provider.username) provider.username = '';
    if (!provider.password) provider.password = '';


    this.provider = provider;

    return new Promise<{ success?: boolean }>(function(resolve, reject) {
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

interface ClassOpt {
    configFilePath?: string;
    provider?: IProviderCF;
    device?: string;
}

export =class WvDial {
    configFilePath: string;
    provider: IProviderCF;
    device;
    constructor(conf: ClassOpt) {
        if (conf.configFilePath) {
            this.configFilePath = conf.configFilePath; // /etc/wvdial.conf
        } else {
            this.configFilePath = '/etc/wvdial.conf';
        }
        if (conf.provider) {
            if (!conf.provider.phone) conf.provider.phone = '*99#';
            if (!conf.provider.username) conf.provider.username = '';
            if (!conf.provider.password) conf.provider.password = '';
            this.provider = conf.provider; // /etc/wvdial.conf
        }

        if (conf.device) {
            this.device = conf.device; // /etc/wvdial.conf
        }

    };

    connect(watch?: boolean) {
        let configFilePath = this.configFilePath;
        let dev = this.device;
        return new Promise<boolean>(function(resolve, reject) {
            console.log('connection');

            getstring(configFilePath, 'Modem').then(function() {
                connect(configFilePath, watch, dev).then(function(answer) {
                    resolve(answer);
                }).catch(function(err) {

                    if (!watch) {

                        reject('rrrrrr');

                    } else {
                        hwrestart("unplug");
                    }


                })
            }).catch(function() {
                if (!watch) {

                    reject('errrr');

                } else {
                    hwrestart("unplug");
                }

            });
        })
    };

    setUsb(device: string) {
        let configFilePath = this.configFilePath;
        return new Promise<{ success?: boolean }>(function(resolve, reject) {

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

    setProvider(provider: IProviderCF) {
        this.provider = provider;
        return setprov(this.configFilePath, provider)

    };

    getConfig() {
        return allstrings(this.configFilePath);
    };

    setParam(key: string, val: string) {
        return setstring(this.configFilePath, key, val);
    };

    getParam(param: string) {
        return getstring(this.configFilePath, param);
    };

    status() {

        return mobilestatus

    }
    setdev(device?: string) {

        if (device) {
            this.device = device;
        }
        let setdev = this.device;
        let configFilePath = this.configFilePath;
        return new Promise<boolean>(function(resolve, reject) {
            lsusbdev().then(function(data) {
                let devto: any = false;
                for (var i = 0; i < data.length; i++) {
                    var usb = data[i];


                    if (usb.type == 'serial' && usb.hub == device && !devto) {
                        console.log('set ' + usb.dev)


                        devto = usb.dev;


                    }
                }


                if (devto) {
                    setstring(configFilePath, 'Modem', devto).then(function() {
                        setdev = device;
                        resolve(true);
                    }).catch(function(err) {
                        reject({ error: 'error on setstring ' });
                    })

                } else {

                    reject({ error: 'error on modem ' });

                }

            })

        })

    }
    configure(reset?: boolean) {
        let provider = this.provider;

        let device = this.device;


        let configFilePath = this.configFilePath;
        return new Promise<{ success?: boolean }>(function(resolve, reject) {
            if (provider) {

                if (!reset && device) {

                    setprov(configFilePath, provider).then(function() {
                        lsusbdev().then(function(data) {
                            let devto: any = false;
                            for (var i = 0; i < data.length; i++) {
                                var usb = data[i];


                                if (usb.type == 'serial' && usb.hub == device && !devto) {
                                    console.log('set ' + usb.dev)


                                    devto = usb.dev;


                                }
                            }


                            if (devto) {
                                setstring(configFilePath, 'Modem', devto).then(function() {

                                    resolve({ success: true });
                                }).catch(function(err) {
                                    reject({ error: 'error on setstring ' });
                                })

                            } else {

                                reject({ error: 'error on modem ' });

                            }

                        })

                    }).catch(function(err) {
                        reject({ error: 'error on setprov ' });
                    })

                } else if (reset) {

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
                    reject({ error: 'miss configuration' });
                }



            } else {
                reject({ error: 'must push a provider' });

            }
        })
    };


};
