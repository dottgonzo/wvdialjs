"use strict";
var Promise = require("bluebird");
var fs = require("fs");
var lsusbdev_1 = require("lsusbdev");
var hwrestart = require('hwrestart');
var exec = require('promised-exec');
var Tail = require('always-tail');
var verb = require('verbo');
var mobilestatus = false;
;
function setstring(configFilePath, key, val) {
    return new Promise(function (resolve, reject) {
        getstring(configFilePath, key).then(function (oldstring) {
            exec('sed -i -e "s/' + key[0].toUpperCase() + key.slice(1) + ' = ' + oldstring.replace(/\'/g, '\\"').replace(/\//g, '\\\/') + '/' + key[0].toUpperCase() + key.slice(1) + ' = ' + val.replace(/\"/g, '\\"').replace(/\//g, '\\\/') + '/g" ' + configFilePath + '').then(function (stdout) {
                resolve({ success: true });
            }).catch(function (err) {
                reject({ error: err });
            });
        }).catch(function (err) {
            reject({ error: err });
        });
    });
}
function getstring(configFilePath, param) {
    return new Promise(function (resolve, reject) {
        allstrings(configFilePath).then(function (data) {
            var test = false;
            for (var i = 0; i < Object.keys(data).length; i++) {
                if (Object.keys(data)[i] === (param[0].toUpperCase() + param.slice(1))) {
                    test = true;
                    resolve(data[Object.keys(data)[i]]);
                }
            }
            if (!test) {
                reject({ error: "wrong param" });
            }
        }).catch(function (err) {
            reject({ error: err });
        });
    });
}
function allstrings(configFilePath) {
    return new Promise(function (resolve, reject) {
        exec(__dirname + '/wvdial.sh  -t "get" -c"' + configFilePath + '"').then(function (data) {
            resolve(JSON.parse(data));
        }).catch(function (err) {
            reject(err);
        });
    });
}
function connect(configFilePath, watch, device) {
    return new Promise(function (resolve, reject) {
        console.log(device);
        var exist = false;
        lsusbdev_1.default().then(function (data) {
            for (var i = 0; i < data.length; i++) {
                var usb = data[i];
                if ((usb.type === 'serial' && device && usb.hub === device) || !device) {
                    exist = true;
                    console.log("pass1");
                }
            }
            if (!exist && device) {
                console.log("no device, rebooting");
                setTimeout(function () {
                    hwrestart("unplug");
                }, 2000);
            }
        });
        console.log(configFilePath);
        var wvdialerr = "/tmp/Wvdial.err";
        var wvdialout = "/tmp/Wvdial.out";
        var lncount = 0;
        function wvconnect() {
            mobilestatus = false;
            if (lncount > 200) {
                if (!watch) {
                    tail.unwatch();
                    reject('timeout?');
                }
                else {
                    console.log("no watch reboot");
                    setTimeout(function () {
                        hwrestart("unplug");
                    }, 2000);
                }
            }
            if (device) {
                lsusbdev_1.default().then(function (data) {
                    var devto = false;
                    for (var i = 0; i < data.length; i++) {
                        var usb = data[i];
                        if (usb.type === 'serial' && usb.hub === device && !devto) {
                            console.log('set ' + usb.dev);
                            devto = usb.dev;
                        }
                    }
                    if (devto) {
                        setstring(configFilePath, 'Modem', devto).then(function () {
                            exec('pkill wvdial && sleep 5 ; modprobe usbserial').then(function () {
                                exec('sleep 5; wvdial Defaults -C ' + configFilePath + ' 1>' + wvdialerr + ' 2>' + wvdialout).catch(function () {
                                    lncount = lncount + 60;
                                    wvconnect();
                                    console.log(lncount);
                                });
                            }).catch(function () {
                                exec('sleep 5; wvdial Defaults -C ' + configFilePath + ' 1>' + wvdialerr + ' 2>' + wvdialout).catch(function () {
                                    lncount = lncount + 60;
                                    wvconnect();
                                    console.log(lncount);
                                });
                            });
                        }).catch(function (err) {
                            console.log(err + " set string error");
                            lncount = lncount + 30;
                            wvconnect();
                            console.log(lncount);
                        });
                    }
                    else {
                        console.log(" err2");
                        lncount = lncount + 30;
                        wvconnect();
                        console.log(lncount);
                    }
                }).catch(function (err) {
                    lncount = lncount + 60;
                    wvconnect();
                    console.log(lncount);
                });
            }
            else {
                exec('pkill wvdial && sleep 5 ; modprobe usbserial').then(function () {
                    exec('sleep 5; wvdial Defaults -C ' + configFilePath + ' 1>' + wvdialerr + ' 2>' + wvdialout).catch(function () {
                        lncount = lncount + 60;
                        wvconnect();
                        console.log(lncount);
                    });
                }).catch(function () {
                    exec('sleep 5; wvdial Defaults -C ' + configFilePath + ' 1>' + wvdialerr + ' 2>' + wvdialout).catch(function () {
                        lncount = lncount + 60;
                        wvconnect();
                        console.log(lncount);
                    });
                });
            }
        }
        fs.writeFileSync(wvdialerr, "");
        fs.writeFileSync(wvdialout, "");
        var tail = new Tail(wvdialout, '\n');
        tail.on('line', function (data) {
            lncount = lncount + 1;
            if (data.split("DNS").length === 2) {
                mobilestatus = true;
                fs.writeFileSync(wvdialerr, "");
                fs.writeFileSync(wvdialout, "");
                lncount = 0;
                console.log('ppp connected');
            }
            else if (lncount > 200) {
                mobilestatus = false;
                if (!watch) {
                    tail.unwatch();
                    reject('unwatch');
                }
                else {
                    console.log('mobile error 0233');
                    setTimeout(function () {
                        hwrestart("unplug");
                    }, 2000);
                }
            }
        });
        tail.on('error', function (data) {
            console.log("tailerror");
            if (!watch) {
                tail.unwatch();
                reject('tail error');
            }
            else {
                console.log('mobile tail error');
                setTimeout(function () {
                    hwrestart("unplug");
                }, 2000);
            }
        });
        tail.watch();
        wvconnect();
    });
}
function setprov(configFilePath, provider) {
    if (!provider.phone)
        provider.phone = '*99#';
    if (!provider.username)
        provider.username = '';
    if (!provider.password)
        provider.password = '';
    this.provider = provider;
    return new Promise(function (resolve, reject) {
        if (provider.apn) {
            setstring(configFilePath, 'Init3', 'AT+CGDCONT=1,"ip","' + provider.apn + '",,0,0').then(function () {
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
            });
        }
        else {
            reject("no apn");
        }
    });
}
;
var WvDial = (function () {
    function WvDial(conf) {
        if (conf.configFilePath) {
            this.configFilePath = conf.configFilePath;
        }
        else {
            this.configFilePath = '/etc/wvdial.conf';
        }
        if (conf.provider) {
            if (!conf.provider.phone)
                conf.provider.phone = '*99#';
            if (!conf.provider.username)
                conf.provider.username = '';
            if (!conf.provider.password)
                conf.provider.password = '';
            this.provider = conf.provider;
        }
        if (conf.device) {
            this.device = conf.device;
        }
    }
    ;
    WvDial.prototype.connect = function (watch) {
        var configFilePath = this.configFilePath;
        var dev = this.device;
        return new Promise(function (resolve, reject) {
            console.log('connection');
            getstring(configFilePath, 'Modem').then(function () {
                connect(configFilePath, watch, dev).then(function (answer) {
                    if (!watch) {
                        console.log('maybe is connected');
                        resolve(answer);
                    }
                    else {
                        console.log('mobile error 0134');
                        setTimeout(function () {
                            hwrestart("unplug");
                        }, 2000);
                    }
                }).catch(function (err) {
                    if (!watch) {
                        reject('rrrrrr');
                    }
                    else {
                        console.log('mobile error 0533');
                        setTimeout(function () {
                            hwrestart("unplug");
                        }, 2000);
                    }
                });
            }).catch(function () {
                if (!watch) {
                    reject('errrr');
                }
                else {
                    console.log('mobile error 0633');
                    setTimeout(function () {
                        hwrestart("unplug");
                    }, 2000);
                }
            });
        });
    };
    ;
    WvDial.prototype.setUsb = function (device) {
        var configFilePath = this.configFilePath;
        return new Promise(function (resolve, reject) {
            if (device) {
                setstring(configFilePath, 'Modem', device.replace(/\//g, '\\\/')).then(function () {
                    resolve({ success: true });
                }).catch(function (err) {
                    reject(err);
                });
            }
            else {
                reject({ error: "No device " + device + " founded" });
            }
        });
    };
    ;
    WvDial.prototype.setProvider = function (provider) {
        this.provider = provider;
        return setprov(this.configFilePath, provider);
    };
    ;
    WvDial.prototype.getConfig = function () {
        return allstrings(this.configFilePath);
    };
    ;
    WvDial.prototype.setParam = function (key, val) {
        return setstring(this.configFilePath, key, val);
    };
    ;
    WvDial.prototype.getParam = function (param) {
        return getstring(this.configFilePath, param);
    };
    ;
    WvDial.prototype.status = function () {
        return mobilestatus;
    };
    WvDial.prototype.setdev = function (device) {
        if (device) {
            this.device = device;
        }
        var setdev = this.device;
        var configFilePath = this.configFilePath;
        return new Promise(function (resolve, reject) {
            lsusbdev_1.default().then(function (data) {
                var devto = false;
                for (var i = 0; i < data.length; i++) {
                    var usb = data[i];
                    if (usb.type === 'serial' && usb.hub === device && !devto) {
                        console.log('set ' + usb.dev);
                        devto = usb.dev;
                    }
                }
                if (devto) {
                    setstring(configFilePath, 'Modem', devto).then(function () {
                        setdev = device;
                        resolve(true);
                    }).catch(function (err) {
                        reject({ error: 'error on setstring ' });
                    });
                }
                else {
                    reject({ error: 'error on modem ' });
                }
            });
        });
    };
    WvDial.prototype.configure = function (reset) {
        var provider = this.provider;
        var device = this.device;
        var configFilePath = this.configFilePath;
        return new Promise(function (resolve, reject) {
            if (provider) {
                if (!reset && device) {
                    setprov(configFilePath, provider).then(function () {
                        lsusbdev_1.default().then(function (data) {
                            var devto = false;
                            for (var i = 0; i < data.length; i++) {
                                var usb = data[i];
                                if (usb.type === 'serial' && usb.hub === device && !devto) {
                                    console.log('set ' + usb.dev);
                                    devto = usb.dev;
                                }
                            }
                            if (devto) {
                                setstring(configFilePath, 'Modem', devto).then(function () {
                                    resolve({ success: true });
                                }).catch(function (err) {
                                    reject({ error: 'error on setstring ' });
                                });
                            }
                            else {
                                reject({ error: 'error on modem ' });
                            }
                        });
                    }).catch(function (err) {
                        reject({ error: 'error on setprov ' });
                    });
                }
                else if (reset) {
                    exec('echo "[Dialer Defaults]" > ' + configFilePath).then(function () {
                        exec('echo \'Init3 = AT+CGDCONT=1,"ip","' + provider.apn + '",,0,0\' >> ' + configFilePath).then(function () {
                            exec('echo "Phone = ' + provider.phone + '" >> ' + configFilePath).then(function () {
                                exec('echo "Username = ' + provider.username + '" >> ' + configFilePath).then(function () {
                                    exec('echo "Password = ' + provider.password + '" >> ' + configFilePath).then(function () {
                                        exec('wvdialconf ' + configFilePath).then(function () {
                                            resolve({ success: true });
                                        }).catch(function (err) {
                                            reject({ error: 'error on modem ' });
                                        });
                                    });
                                });
                            });
                        });
                    }).catch(function (err) {
                        reject({ error: 'error on open ' + configFilePath });
                    });
                }
                else {
                    reject({ error: 'miss configuration' });
                }
            }
            else {
                reject({ error: 'must push a provider' });
            }
        });
    };
    ;
    return WvDial;
}());
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = WvDial;
;

//# sourceMappingURL=data:application/json;charset=utf8;base64,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Q0FBQyxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO3dDQUMvQixDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsVUFBVSxHQUFHOzRDQUNsQixNQUFNLENBQUMsRUFBRSxLQUFLLEVBQUUsaUJBQWlCLEVBQUUsQ0FBQyxDQUFDO3dDQUN6QyxDQUFDLENBQUMsQ0FBQTtvQ0FLTixDQUFDLENBQUMsQ0FBQTtnQ0FDTixDQUFDLENBQUMsQ0FBQTs0QkFDTixDQUFDLENBQUMsQ0FBQTt3QkFDTixDQUFDLENBQUMsQ0FBQTtvQkFFTixDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsVUFBVSxHQUFHO3dCQUNsQixNQUFNLENBQUMsRUFBRSxLQUFLLEVBQUUsZ0JBQWdCLEdBQUcsY0FBYyxFQUFFLENBQUMsQ0FBQztvQkFFekQsQ0FBQyxDQUFDLENBQUM7Z0JBR1AsQ0FBQztnQkFBQyxJQUFJLENBQUMsQ0FBQztvQkFDSixNQUFNLENBQUMsRUFBRSxLQUFLLEVBQUUsb0JBQW9CLEVBQUUsQ0FBQyxDQUFDO2dCQUM1QyxDQUFDO1lBSUwsQ0FBQztZQUFDLElBQUksQ0FBQyxDQUFDO2dCQUNKLE1BQU0sQ0FBQyxFQUFFLEtBQUssRUFBRSxzQkFBc0IsRUFBRSxDQUFDLENBQUM7WUFFOUMsQ0FBQztRQUNMLENBQUMsQ0FBQyxDQUFBO0lBQ04sQ0FBQzs7SUFHTCxhQUFDO0FBQUQsQ0FuUUEsQUFtUUMsSUFBQTtBQW5RRDt3QkFtUUMsQ0FBQTtBQUFBLENBQUMiLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBQcm9taXNlIGZyb20gXCJibHVlYmlyZFwiO1xuaW1wb3J0ICogYXMgcGF0aEV4aXN0cyBmcm9tIFwicGF0aC1leGlzdHNcIjtcbmltcG9ydCAqIGFzIGZzIGZyb20gXCJmc1wiO1xuaW1wb3J0IGxzdXNiZGV2IGZyb20gXCJsc3VzYmRldlwiO1xuY29uc3QgaHdyZXN0YXJ0ID0gcmVxdWlyZSgnaHdyZXN0YXJ0Jyk7XG5cbmNvbnN0IGV4ZWMgPSByZXF1aXJlKCdwcm9taXNlZC1leGVjJyk7XG5jb25zdCBUYWlsID0gcmVxdWlyZSgnYWx3YXlzLXRhaWwnKTtcblxuY29uc3QgdmVyYiA9IHJlcXVpcmUoJ3ZlcmJvJyk7XG5cbmxldCBtb2JpbGVzdGF0dXMgPSBmYWxzZTtcblxuLy9zcGF3biA9IHJlcXVpcmUoJ2NoaWxkX3Byb2Nlc3MnKS5zcGF3bixcblxuXG5pbnRlcmZhY2UgSUNvbmZPcHQge1xuICAgIHZlcmJvc2U/OiBib29sZWFuO1xuICAgIGRldj86IGFueTtcbiAgICBwcm92aWRlcjogSVByb3ZpZGVyQ0Y7XG59O1xuXG5cbmludGVyZmFjZSBJUHJvdmlkZXJDRiB7XG5cbiAgICBsYWJlbD86IHN0cmluZztcbiAgICBhcG46IHN0cmluZztcbiAgICBwaG9uZT86IHN0cmluZztcbiAgICB1c2VybmFtZT86IHN0cmluZztcbiAgICBwYXNzd29yZD86IHN0cmluZztcblxufVxuaW50ZXJmYWNlIElQcm92aWRlciB7XG5cbiAgICBsYWJlbD86IHN0cmluZztcbiAgICBhcG46IHN0cmluZztcbiAgICBwaG9uZTogc3RyaW5nO1xuICAgIHVzZXJuYW1lOiBzdHJpbmc7XG4gICAgcGFzc3dvcmQ6IHN0cmluZztcblxufVxuLy8gbW9kcHJvYmUgdXNic2VyaWFsXG4vLyB3dmRpYWxjb25mXG4vLyB3dmRpYWwgRGVmYXVsdHMgMT4vZGV2L251bGwgMj4vZGV2L251bGxcblxuZnVuY3Rpb24gc2V0c3RyaW5nKGNvbmZpZ0ZpbGVQYXRoOiBzdHJpbmcsIGtleSwgdmFsKSB7XG5cbiAgICByZXR1cm4gbmV3IFByb21pc2U8eyBzdWNjZXNzPzogYm9vbGVhbiB9PihmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgIGdldHN0cmluZyhjb25maWdGaWxlUGF0aCwga2V5KS50aGVuKGZ1bmN0aW9uIChvbGRzdHJpbmc6IHN0cmluZykge1xuICAgICAgICAgICAgZXhlYygnc2VkIC1pIC1lIFwicy8nICsga2V5WzBdLnRvVXBwZXJDYXNlKCkgKyBrZXkuc2xpY2UoMSkgKyAnID0gJyArIG9sZHN0cmluZy5yZXBsYWNlKC9cXCcvZywgJ1xcXFxcIicpLnJlcGxhY2UoL1xcLy9nLCAnXFxcXFxcLycpICsgJy8nICsga2V5WzBdLnRvVXBwZXJDYXNlKCkgKyBrZXkuc2xpY2UoMSkgKyAnID0gJyArIHZhbC5yZXBsYWNlKC9cXFwiL2csICdcXFxcXCInKS5yZXBsYWNlKC9cXC8vZywgJ1xcXFxcXC8nKSArICcvZ1wiICcgKyBjb25maWdGaWxlUGF0aCArICcnKS50aGVuKGZ1bmN0aW9uIChzdGRvdXQpIHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKHsgc3VjY2VzczogdHJ1ZSB9KTtcbiAgICAgICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICByZWplY3QoeyBlcnJvcjogZXJyIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgIHJlamVjdCh7IGVycm9yOiBlcnIgfSk7XG4gICAgICAgIH0pO1xuICAgIH0pO1xufVxuZnVuY3Rpb24gZ2V0c3RyaW5nKGNvbmZpZ0ZpbGVQYXRoOiBzdHJpbmcsIHBhcmFtKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgYWxsc3RyaW5ncyhjb25maWdGaWxlUGF0aCkudGhlbihmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICAgICAgbGV0IHRlc3QgPSBmYWxzZTtcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgT2JqZWN0LmtleXMoZGF0YSkubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAoT2JqZWN0LmtleXMoZGF0YSlbaV0gPT09IChwYXJhbVswXS50b1VwcGVyQ2FzZSgpICsgcGFyYW0uc2xpY2UoMSkpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRlc3QgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKGRhdGFbT2JqZWN0LmtleXMoZGF0YSlbaV1dKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIXRlc3QpIHtcbiAgICAgICAgICAgICAgICByZWplY3QoeyBlcnJvcjogXCJ3cm9uZyBwYXJhbVwiIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KS5jYXRjaChmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICByZWplY3QoeyBlcnJvcjogZXJyIH0pO1xuICAgICAgICB9KVxuICAgIH0pXG59XG5mdW5jdGlvbiBhbGxzdHJpbmdzKGNvbmZpZ0ZpbGVQYXRoOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xuXG4gICAgICAgIGV4ZWMoX19kaXJuYW1lICsgJy93dmRpYWwuc2ggIC10IFwiZ2V0XCIgLWNcIicgKyBjb25maWdGaWxlUGF0aCArICdcIicpLnRoZW4oZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgICAgIHJlc29sdmUoSlNPTi5wYXJzZShkYXRhKSk7XG4gICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICB9KVxuICAgIH0pXG59XG5cbmZ1bmN0aW9uIGNvbm5lY3QoY29uZmlnRmlsZVBhdGg6IHN0cmluZywgd2F0Y2g/OiBib29sZWFuLCBkZXZpY2U/OiBzdHJpbmcpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2U8Ym9vbGVhbj4oZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xuXG5cbiAgICAgICAgY29uc29sZS5sb2coZGV2aWNlKVxuXG4gICAgICAgIGxldCBleGlzdCA9IGZhbHNlO1xuICAgICAgICBsc3VzYmRldigpLnRoZW4oZnVuY3Rpb24gKGRhdGE6IFt7IHR5cGU6IHN0cmluZywgZGV2OiBzdHJpbmcsIHByb2R1Y3Q6IHN0cmluZywgaHViOiBzdHJpbmcsIGlkOiBzdHJpbmcgfV0pIHtcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHZhciB1c2IgPSBkYXRhW2ldO1xuICAgICAgICAgICAgICAgIGlmICgodXNiLnR5cGUgPT09ICdzZXJpYWwnICYmIGRldmljZSAmJiB1c2IuaHViID09PSBkZXZpY2UpIHx8ICFkZXZpY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgZXhpc3QgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcInBhc3MxXCIpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCFleGlzdCAmJiBkZXZpY2UpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIm5vIGRldmljZSwgcmVib290aW5nXCIpXG4gICAgICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGh3cmVzdGFydChcInVucGx1Z1wiKVxuICAgICAgICAgICAgICAgIH0sIDIwMDApXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG5cblxuXG4gICAgICAgIC8vIGNoZWNrIGlmIHd2ZGlhbC5jb25mIHVzYiBpcyBwcmVzZW50XG4gICAgICAgIGNvbnNvbGUubG9nKGNvbmZpZ0ZpbGVQYXRoKVxuXG5cbiAgICAgICAgbGV0IHd2ZGlhbGVyciA9IFwiL3RtcC9XdmRpYWwuZXJyXCJcbiAgICAgICAgbGV0IHd2ZGlhbG91dCA9IFwiL3RtcC9XdmRpYWwub3V0XCJcblxuICAgICAgICBsZXQgbG5jb3VudCA9IDA7XG5cbiAgICAgICAgZnVuY3Rpb24gd3Zjb25uZWN0KCkge1xuICAgICAgICAgICAgbW9iaWxlc3RhdHVzID0gZmFsc2U7XG4gICAgICAgICAgICBpZiAobG5jb3VudCA+IDIwMCkge1xuXG5cblxuICAgICAgICAgICAgICAgIGlmICghd2F0Y2gpIHtcbiAgICAgICAgICAgICAgICAgICAgdGFpbC51bndhdGNoKCk7XG4gICAgICAgICAgICAgICAgICAgIHJlamVjdCgndGltZW91dD8nKTtcblxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwibm8gd2F0Y2ggcmVib290XCIpXG5cbiAgICAgICAgICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBod3Jlc3RhcnQoXCJ1bnBsdWdcIilcbiAgICAgICAgICAgICAgICAgICAgfSwgMjAwMClcblxuXG4gICAgICAgICAgICAgICAgfVxuXG5cblxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGRldmljZSkge1xuXG5cbiAgICAgICAgICAgICAgICBsc3VzYmRldigpLnRoZW4oZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGRldnRvOiBhbnkgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBkYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgdXNiID0gZGF0YVtpXTtcblxuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodXNiLnR5cGUgPT09ICdzZXJpYWwnICYmIHVzYi5odWIgPT09IGRldmljZSAmJiAhZGV2dG8pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnc2V0ICcgKyB1c2IuZGV2KVxuXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXZ0byA9IHVzYi5kZXY7XG5cblxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG5cblxuICAgICAgICAgICAgICAgICAgICBpZiAoZGV2dG8pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNldHN0cmluZyhjb25maWdGaWxlUGF0aCwgJ01vZGVtJywgZGV2dG8pLnRoZW4oZnVuY3Rpb24gKCkge1xuXG5cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV4ZWMoJ3BraWxsIHd2ZGlhbCAmJiBzbGVlcCA1IDsgbW9kcHJvYmUgdXNic2VyaWFsJykudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV4ZWMoJ3NsZWVwIDU7IHd2ZGlhbCBEZWZhdWx0cyAtQyAnICsgY29uZmlnRmlsZVBhdGggKyAnIDE+JyArIHd2ZGlhbGVyciArICcgMj4nICsgd3ZkaWFsb3V0KS5jYXRjaChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsbmNvdW50ID0gbG5jb3VudCArIDYwXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB3dmNvbm5lY3QoKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2cobG5jb3VudClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBleGVjKCdzbGVlcCA1OyB3dmRpYWwgRGVmYXVsdHMgLUMgJyArIGNvbmZpZ0ZpbGVQYXRoICsgJyAxPicgKyB3dmRpYWxlcnIgKyAnIDI+JyArIHd2ZGlhbG91dCkuY2F0Y2goZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG5jb3VudCA9IGxuY291bnQgKyA2MFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgd3Zjb25uZWN0KClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGxuY291bnQpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24gKGVycikge1xuXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhlcnIgKyBcIiBzZXQgc3RyaW5nIGVycm9yXCIpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG5jb3VudCA9IGxuY291bnQgKyAzMFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHd2Y29ubmVjdCgpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2cobG5jb3VudClcblxuXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCIgZXJyMlwiKVxuICAgICAgICAgICAgICAgICAgICAgICAgbG5jb3VudCA9IGxuY291bnQgKyAzMFxuICAgICAgICAgICAgICAgICAgICAgICAgd3Zjb25uZWN0KClcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGxuY291bnQpXG5cblxuXG4gICAgICAgICAgICAgICAgICAgIH1cblxuXG4gICAgICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgICAgICBsbmNvdW50ID0gbG5jb3VudCArIDYwXG4gICAgICAgICAgICAgICAgICAgIHd2Y29ubmVjdCgpXG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGxuY291bnQpXG5cbiAgICAgICAgICAgICAgICB9KTtcblxuXG4gICAgICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAgICAgZXhlYygncGtpbGwgd3ZkaWFsICYmIHNsZWVwIDUgOyBtb2Rwcm9iZSB1c2JzZXJpYWwnKS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgZXhlYygnc2xlZXAgNTsgd3ZkaWFsIERlZmF1bHRzIC1DICcgKyBjb25maWdGaWxlUGF0aCArICcgMT4nICsgd3ZkaWFsZXJyICsgJyAyPicgKyB3dmRpYWxvdXQpLmNhdGNoKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxuY291bnQgPSBsbmNvdW50ICsgNjBcbiAgICAgICAgICAgICAgICAgICAgICAgIHd2Y29ubmVjdCgpXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhsbmNvdW50KVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9KS5jYXRjaChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIGV4ZWMoJ3NsZWVwIDU7IHd2ZGlhbCBEZWZhdWx0cyAtQyAnICsgY29uZmlnRmlsZVBhdGggKyAnIDE+JyArIHd2ZGlhbGVyciArICcgMj4nICsgd3ZkaWFsb3V0KS5jYXRjaChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsbmNvdW50ID0gbG5jb3VudCArIDYwXG4gICAgICAgICAgICAgICAgICAgICAgICB3dmNvbm5lY3QoKVxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2cobG5jb3VudClcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG5cbiAgICAgICAgZnMud3JpdGVGaWxlU3luYyh3dmRpYWxlcnIsIFwiXCIpO1xuXG4gICAgICAgIGZzLndyaXRlRmlsZVN5bmMod3ZkaWFsb3V0LCBcIlwiKTtcblxuXG5cbiAgICAgICAgdmFyIHRhaWwgPSBuZXcgVGFpbCh3dmRpYWxvdXQsICdcXG4nKTtcblxuICAgICAgICB0YWlsLm9uKCdsaW5lJywgZnVuY3Rpb24gKGRhdGEpIHtcblxuICAgICAgICAgICAgbG5jb3VudCA9IGxuY291bnQgKyAxO1xuXG5cbiAgICAgICAgICAgIGlmIChkYXRhLnNwbGl0KFwiRE5TXCIpLmxlbmd0aCA9PT0gMikge1xuXG4gICAgICAgICAgICAgICAgLy8gc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgLy8gICBleGVjKCdpcCByb3V0ZSBhZGQgZGVmYXVsdCBkZXYgcHBwMCcpXG4gICAgICAgICAgICAgICAgLy8gfSwgMzAwMDApO1xuICAgICAgICAgICAgICAgIG1vYmlsZXN0YXR1cyA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKHd2ZGlhbGVyciwgXCJcIik7XG5cbiAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKHd2ZGlhbG91dCwgXCJcIik7XG5cbiAgICAgICAgICAgICAgICBsbmNvdW50ID0gMDtcblxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdwcHAgY29ubmVjdGVkJylcblxuICAgICAgICAgICAgICAgIC8vICAgIGlmICghd2F0Y2gpIHtcbiAgICAgICAgICAgICAgICAvLyAgICAgICAgdGFpbC51bndhdGNoKCk7XG4gICAgICAgICAgICAgICAgLy8gICAgICAgcmVzb2x2ZSh0cnVlKTtcblxuICAgICAgICAgICAgICAgIC8vICAgIH1cblxuXG5cbiAgICAgICAgICAgIH0gZWxzZSBpZiAobG5jb3VudCA+IDIwMCkge1xuICAgICAgICAgICAgICAgIG1vYmlsZXN0YXR1cyA9IGZhbHNlO1xuXG4gICAgICAgICAgICAgICAgaWYgKCF3YXRjaCkge1xuICAgICAgICAgICAgICAgICAgICB0YWlsLnVud2F0Y2goKTtcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KCd1bndhdGNoJyk7XG5cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnbW9iaWxlIGVycm9yIDAyMzMnKVxuICAgICAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGh3cmVzdGFydChcInVucGx1Z1wiKVxuICAgICAgICAgICAgICAgICAgICB9LCAyMDAwKVxuXG5cbiAgICAgICAgICAgICAgICB9XG5cblxuXG5cblxuICAgICAgICAgICAgfVxuXG4gICAgICAgIH0pO1xuXG5cbiAgICAgICAgdGFpbC5vbignZXJyb3InLCBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coXCJ0YWlsZXJyb3JcIik7XG5cblxuICAgICAgICAgICAgaWYgKCF3YXRjaCkge1xuICAgICAgICAgICAgICAgIHRhaWwudW53YXRjaCgpO1xuICAgICAgICAgICAgICAgIHJlamVjdCgndGFpbCBlcnJvcicpO1xuXG4gICAgICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ21vYmlsZSB0YWlsIGVycm9yJylcbiAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaHdyZXN0YXJ0KFwidW5wbHVnXCIpXG4gICAgICAgICAgICAgICAgfSwgMjAwMClcblxuICAgICAgICAgICAgfVxuXG5cblxuXG5cblxuICAgICAgICB9KTtcblxuICAgICAgICB0YWlsLndhdGNoKCk7XG5cbiAgICAgICAgd3Zjb25uZWN0KClcblxuXG5cblxuXG5cblxuXG5cbiAgICB9KVxufVxuXG5cbmZ1bmN0aW9uIHNldHByb3YoY29uZmlnRmlsZVBhdGgsIHByb3ZpZGVyOiBJUHJvdmlkZXJDRikge1xuXG5cblxuXG4gICAgaWYgKCFwcm92aWRlci5waG9uZSkgcHJvdmlkZXIucGhvbmUgPSAnKjk5Iyc7XG4gICAgaWYgKCFwcm92aWRlci51c2VybmFtZSkgcHJvdmlkZXIudXNlcm5hbWUgPSAnJztcbiAgICBpZiAoIXByb3ZpZGVyLnBhc3N3b3JkKSBwcm92aWRlci5wYXNzd29yZCA9ICcnO1xuXG5cbiAgICB0aGlzLnByb3ZpZGVyID0gcHJvdmlkZXI7XG5cbiAgICByZXR1cm4gbmV3IFByb21pc2U8eyBzdWNjZXNzPzogYm9vbGVhbiB9PihmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgIGlmIChwcm92aWRlci5hcG4pIHtcbiAgICAgICAgICAgIHNldHN0cmluZyhjb25maWdGaWxlUGF0aCwgJ0luaXQzJywgJ0FUK0NHRENPTlQ9MSxcImlwXCIsXCInICsgcHJvdmlkZXIuYXBuICsgJ1wiLCwwLDAnKS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnb2sgYXBuJyk7XG4gICAgICAgICAgICAgICAgaWYgKHByb3ZpZGVyLnBob25lKSB7XG4gICAgICAgICAgICAgICAgICAgIHNldHN0cmluZyhjb25maWdGaWxlUGF0aCwgJ1Bob25lJywgcHJvdmlkZXIucGhvbmUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAocHJvdmlkZXIudXNlcm5hbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgc2V0c3RyaW5nKGNvbmZpZ0ZpbGVQYXRoLCAnVXNlcm5hbWUnLCBwcm92aWRlci51c2VybmFtZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChwcm92aWRlci5wYXNzd29yZCkge1xuICAgICAgICAgICAgICAgICAgICBzZXRzdHJpbmcoY29uZmlnRmlsZVBhdGgsICdQYXNzd29yZCcsIHByb3ZpZGVyLnBhc3N3b3JkKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmVzb2x2ZSh7IHN1Y2Nlc3M6IHRydWUgfSk7XG4gICAgICAgICAgICB9KVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVqZWN0KFwibm8gYXBuXCIpO1xuICAgICAgICB9XG4gICAgfSlcblxufTtcblxuaW50ZXJmYWNlIENsYXNzT3B0IHtcbiAgICBjb25maWdGaWxlUGF0aD86IHN0cmluZztcbiAgICBwcm92aWRlcj86IElQcm92aWRlckNGO1xuICAgIGRldmljZT86IHN0cmluZztcbn1cblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgV3ZEaWFsIHtcbiAgICBjb25maWdGaWxlUGF0aDogc3RyaW5nO1xuICAgIHByb3ZpZGVyOiBJUHJvdmlkZXJDRjtcbiAgICBkZXZpY2U7XG4gICAgY29uc3RydWN0b3IoY29uZjogQ2xhc3NPcHQpIHtcbiAgICAgICAgaWYgKGNvbmYuY29uZmlnRmlsZVBhdGgpIHtcbiAgICAgICAgICAgIHRoaXMuY29uZmlnRmlsZVBhdGggPSBjb25mLmNvbmZpZ0ZpbGVQYXRoOyAvLyAvZXRjL3d2ZGlhbC5jb25mXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmNvbmZpZ0ZpbGVQYXRoID0gJy9ldGMvd3ZkaWFsLmNvbmYnO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjb25mLnByb3ZpZGVyKSB7XG4gICAgICAgICAgICBpZiAoIWNvbmYucHJvdmlkZXIucGhvbmUpIGNvbmYucHJvdmlkZXIucGhvbmUgPSAnKjk5Iyc7XG4gICAgICAgICAgICBpZiAoIWNvbmYucHJvdmlkZXIudXNlcm5hbWUpIGNvbmYucHJvdmlkZXIudXNlcm5hbWUgPSAnJztcbiAgICAgICAgICAgIGlmICghY29uZi5wcm92aWRlci5wYXNzd29yZCkgY29uZi5wcm92aWRlci5wYXNzd29yZCA9ICcnO1xuICAgICAgICAgICAgdGhpcy5wcm92aWRlciA9IGNvbmYucHJvdmlkZXI7IC8vIC9ldGMvd3ZkaWFsLmNvbmZcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjb25mLmRldmljZSkge1xuICAgICAgICAgICAgdGhpcy5kZXZpY2UgPSBjb25mLmRldmljZTsgLy8gL2V0Yy93dmRpYWwuY29uZlxuICAgICAgICB9XG5cbiAgICB9O1xuXG4gICAgY29ubmVjdCh3YXRjaD86IGJvb2xlYW4pIHtcbiAgICAgICAgbGV0IGNvbmZpZ0ZpbGVQYXRoID0gdGhpcy5jb25maWdGaWxlUGF0aDtcbiAgICAgICAgbGV0IGRldiA9IHRoaXMuZGV2aWNlO1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2U8Ym9vbGVhbj4oZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ2Nvbm5lY3Rpb24nKTtcblxuICAgICAgICAgICAgZ2V0c3RyaW5nKGNvbmZpZ0ZpbGVQYXRoLCAnTW9kZW0nKS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBjb25uZWN0KGNvbmZpZ0ZpbGVQYXRoLCB3YXRjaCwgZGV2KS50aGVuKGZ1bmN0aW9uIChhbnN3ZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF3YXRjaCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ21heWJlIGlzIGNvbm5lY3RlZCcpXG4gICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKGFuc3dlcik7XG5cbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ21vYmlsZSBlcnJvciAwMTM0JylcbiAgICAgICAgICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGh3cmVzdGFydChcInVucGx1Z1wiKVxuICAgICAgICAgICAgICAgICAgICAgICAgfSwgMjAwMClcblxuXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KS5jYXRjaChmdW5jdGlvbiAoZXJyKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKCF3YXRjaCkge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoJ3JycnJycicpO1xuXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdtb2JpbGUgZXJyb3IgMDUzMycpXG4gICAgICAgICAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBod3Jlc3RhcnQoXCJ1bnBsdWdcIilcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sIDIwMDApXG5cbiAgICAgICAgICAgICAgICAgICAgfVxuXG5cbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIGlmICghd2F0Y2gpIHtcblxuICAgICAgICAgICAgICAgICAgICByZWplY3QoJ2VycnJyJyk7XG5cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdtb2JpbGUgZXJyb3IgMDYzMycpXG4gICAgICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgaHdyZXN0YXJ0KFwidW5wbHVnXCIpXG4gICAgICAgICAgICAgICAgICAgIH0sIDIwMDApXG5cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KVxuICAgIH07XG5cbiAgICBzZXRVc2IoZGV2aWNlOiBzdHJpbmcpIHtcbiAgICAgICAgbGV0IGNvbmZpZ0ZpbGVQYXRoID0gdGhpcy5jb25maWdGaWxlUGF0aDtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlPHsgc3VjY2Vzcz86IGJvb2xlYW4gfT4oZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xuXG4gICAgICAgICAgICBpZiAoZGV2aWNlKSB7XG4gICAgICAgICAgICAgICAgc2V0c3RyaW5nKGNvbmZpZ0ZpbGVQYXRoLCAnTW9kZW0nLCBkZXZpY2UucmVwbGFjZSgvXFwvL2csICdcXFxcXFwvJykpLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHsgc3VjY2VzczogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICB9KS5jYXRjaChmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuXG4gICAgICAgICAgICAgICAgfSk7XG5cblxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZWplY3QoeyBlcnJvcjogXCJObyBkZXZpY2UgXCIgKyBkZXZpY2UgKyBcIiBmb3VuZGVkXCIgfSk7XG5cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICB9O1xuXG4gICAgc2V0UHJvdmlkZXIocHJvdmlkZXI6IElQcm92aWRlckNGKSB7XG4gICAgICAgIHRoaXMucHJvdmlkZXIgPSBwcm92aWRlcjtcbiAgICAgICAgcmV0dXJuIHNldHByb3YodGhpcy5jb25maWdGaWxlUGF0aCwgcHJvdmlkZXIpXG5cbiAgICB9O1xuXG4gICAgZ2V0Q29uZmlnKCkge1xuICAgICAgICByZXR1cm4gYWxsc3RyaW5ncyh0aGlzLmNvbmZpZ0ZpbGVQYXRoKTtcbiAgICB9O1xuXG4gICAgc2V0UGFyYW0oa2V5OiBzdHJpbmcsIHZhbDogc3RyaW5nKSB7XG4gICAgICAgIHJldHVybiBzZXRzdHJpbmcodGhpcy5jb25maWdGaWxlUGF0aCwga2V5LCB2YWwpO1xuICAgIH07XG5cbiAgICBnZXRQYXJhbShwYXJhbTogc3RyaW5nKSB7XG4gICAgICAgIHJldHVybiBnZXRzdHJpbmcodGhpcy5jb25maWdGaWxlUGF0aCwgcGFyYW0pO1xuICAgIH07XG5cbiAgICBzdGF0dXMoKSB7XG5cbiAgICAgICAgcmV0dXJuIG1vYmlsZXN0YXR1c1xuXG4gICAgfVxuICAgIHNldGRldihkZXZpY2U/OiBzdHJpbmcpIHtcblxuICAgICAgICBpZiAoZGV2aWNlKSB7XG4gICAgICAgICAgICB0aGlzLmRldmljZSA9IGRldmljZTtcbiAgICAgICAgfVxuICAgICAgICBsZXQgc2V0ZGV2ID0gdGhpcy5kZXZpY2U7XG4gICAgICAgIGxldCBjb25maWdGaWxlUGF0aCA9IHRoaXMuY29uZmlnRmlsZVBhdGg7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZTxib29sZWFuPihmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgICAgICBsc3VzYmRldigpLnRoZW4oZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgICAgICAgICBsZXQgZGV2dG86IGFueSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICB2YXIgdXNiID0gZGF0YVtpXTtcblxuXG4gICAgICAgICAgICAgICAgICAgIGlmICh1c2IudHlwZSA9PT0gJ3NlcmlhbCcgJiYgdXNiLmh1YiA9PT0gZGV2aWNlICYmICFkZXZ0bykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ3NldCAnICsgdXNiLmRldilcblxuXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXZ0byA9IHVzYi5kZXY7XG5cblxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG5cbiAgICAgICAgICAgICAgICBpZiAoZGV2dG8pIHtcbiAgICAgICAgICAgICAgICAgICAgc2V0c3RyaW5nKGNvbmZpZ0ZpbGVQYXRoLCAnTW9kZW0nLCBkZXZ0bykudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZXRkZXYgPSBkZXZpY2U7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHRydWUpO1xuICAgICAgICAgICAgICAgICAgICB9KS5jYXRjaChmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoeyBlcnJvcjogJ2Vycm9yIG9uIHNldHN0cmluZyAnIH0pO1xuICAgICAgICAgICAgICAgICAgICB9KVxuXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgICAgICAgICByZWplY3QoeyBlcnJvcjogJ2Vycm9yIG9uIG1vZGVtICcgfSk7XG5cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIH0pXG5cbiAgICAgICAgfSlcblxuICAgIH1cbiAgICBjb25maWd1cmUocmVzZXQ/OiBib29sZWFuKSB7XG4gICAgICAgIGxldCBwcm92aWRlciA9IHRoaXMucHJvdmlkZXI7XG5cbiAgICAgICAgbGV0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuXG5cbiAgICAgICAgbGV0IGNvbmZpZ0ZpbGVQYXRoID0gdGhpcy5jb25maWdGaWxlUGF0aDtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlPHsgc3VjY2Vzcz86IGJvb2xlYW4gfT4oZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAgICAgaWYgKHByb3ZpZGVyKSB7XG5cbiAgICAgICAgICAgICAgICBpZiAoIXJlc2V0ICYmIGRldmljZSkge1xuXG4gICAgICAgICAgICAgICAgICAgIHNldHByb3YoY29uZmlnRmlsZVBhdGgsIHByb3ZpZGVyKS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxzdXNiZGV2KCkudGhlbihmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCBkZXZ0bzogYW55ID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBkYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciB1c2IgPSBkYXRhW2ldO1xuXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHVzYi50eXBlID09PSAnc2VyaWFsJyAmJiB1c2IuaHViID09PSBkZXZpY2UgJiYgIWRldnRvKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnc2V0ICcgKyB1c2IuZGV2KVxuXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRldnRvID0gdXNiLmRldjtcblxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkZXZ0bykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZXRzdHJpbmcoY29uZmlnRmlsZVBhdGgsICdNb2RlbScsIGRldnRvKS50aGVuKGZ1bmN0aW9uICgpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh7IHN1Y2Nlc3M6IHRydWUgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdCh7IGVycm9yOiAnZXJyb3Igb24gc2V0c3RyaW5nICcgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdCh7IGVycm9yOiAnZXJyb3Igb24gbW9kZW0gJyB9KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgfSlcblxuICAgICAgICAgICAgICAgICAgICB9KS5jYXRjaChmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoeyBlcnJvcjogJ2Vycm9yIG9uIHNldHByb3YgJyB9KTtcbiAgICAgICAgICAgICAgICAgICAgfSlcblxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAocmVzZXQpIHtcblxuICAgICAgICAgICAgICAgICAgICBleGVjKCdlY2hvIFwiW0RpYWxlciBEZWZhdWx0c11cIiA+ICcgKyBjb25maWdGaWxlUGF0aCkudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBleGVjKCdlY2hvIFxcJ0luaXQzID0gQVQrQ0dEQ09OVD0xLFwiaXBcIixcIicgKyBwcm92aWRlci5hcG4gKyAnXCIsLDAsMFxcJyA+PiAnICsgY29uZmlnRmlsZVBhdGgpLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV4ZWMoJ2VjaG8gXCJQaG9uZSA9ICcgKyBwcm92aWRlci5waG9uZSArICdcIiA+PiAnICsgY29uZmlnRmlsZVBhdGgpLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBleGVjKCdlY2hvIFwiVXNlcm5hbWUgPSAnICsgcHJvdmlkZXIudXNlcm5hbWUgKyAnXCIgPj4gJyArIGNvbmZpZ0ZpbGVQYXRoKS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV4ZWMoJ2VjaG8gXCJQYXNzd29yZCA9ICcgKyBwcm92aWRlci5wYXNzd29yZCArICdcIiA+PiAnICsgY29uZmlnRmlsZVBhdGgpLnRoZW4oZnVuY3Rpb24gKCkge1xuXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBleGVjKCd3dmRpYWxjb25mICcgKyBjb25maWdGaWxlUGF0aCkudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUoeyBzdWNjZXNzOiB0cnVlIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KHsgZXJyb3I6ICdlcnJvciBvbiBtb2RlbSAnIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pXG5cblxuXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXG5cbiAgICAgICAgICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KHsgZXJyb3I6ICdlcnJvciBvbiBvcGVuICcgKyBjb25maWdGaWxlUGF0aCB9KTtcblxuICAgICAgICAgICAgICAgICAgICB9KTtcblxuXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KHsgZXJyb3I6ICdtaXNzIGNvbmZpZ3VyYXRpb24nIH0pO1xuICAgICAgICAgICAgICAgIH1cblxuXG5cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVqZWN0KHsgZXJyb3I6ICdtdXN0IHB1c2ggYSBwcm92aWRlcicgfSk7XG5cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICB9O1xuXG5cbn07XG4iXX0=
