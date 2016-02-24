var Promise = require("bluebird");
var fs = require("fs");
var lsusbdev = require("lsusbdev");
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
                if (Object.keys(data)[i] == (param[0].toUpperCase() + param.slice(1))) {
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
        lsusbdev().then(function (data) {
            for (var i = 0; i < data.length; i++) {
                var usb = data[i];
                if (usb.type == 'serial' && (device && usb.hub == device) || !device) {
                    exist = true;
                    console.log("pass1");
                }
            }
        });
        if (!exist)
            hwrestart("reboot");
        console.log(configFilePath);
        var wvdialerr = "/tmp/Wvdial.err";
        var wvdialout = "/tmp/Wvdial.out";
        var lncount = 0;
        function wvconnect() {
            mobilestatus = false;
            if (lncount > 200) {
                if (!watch) {
                    tail.unwatch();
                    reject(true);
                }
                else {
                    console.log("reboot");
                    hwrestart("unplug");
                }
            }
            if (device) {
                lsusbdev().then(function (data) {
                    var devto = false;
                    for (var i = 0; i < data.length; i++) {
                        var usb = data[i];
                        if (usb.type == 'serial' && usb.hub == device && !devto) {
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
            if (data.split("DNS").length == 2) {
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
                    reject(true);
                }
                else {
                    hwrestart("unplug");
                }
            }
        });
        tail.on('error', function (data) {
            console.log("tailerror");
            if (!watch) {
                tail.unwatch();
                reject(true);
            }
            else {
                hwrestart("unplug");
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
module.exports = (function () {
    function WvDial(path, device) {
        if (path) {
            this.configFilePath = path;
        }
        else {
            this.configFilePath = '/etc/wvdial.conf';
        }
        if (device) {
            this.device = device;
        }
        else {
            this.device = false;
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
                    resolve(answer);
                }).catch(function (err) {
                    reject(err);
                });
            }).catch(function () {
                reject('err1');
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
        var setdev = this.device;
        var configFilePath = this.configFilePath;
        return new Promise(function (resolve, reject) {
            lsusbdev().then(function (data) {
                var devto = false;
                for (var i = 0; i < data.length; i++) {
                    var usb = data[i];
                    if (usb.type == 'serial' && usb.hub == device && !devto) {
                        console.log('set ' + usb.dev);
                        devto = usb.dev;
                    }
                }
                if (devto) {
                    setstring(configFilePath, 'Modem', devto).then(function () {
                        setdev = device;
                        resolve({ success: true });
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
    WvDial.prototype.configure = function (provider) {
        var device = this.device;
        var configFilePath = this.configFilePath;
        return new Promise(function (resolve, reject) {
            if (provider) {
                if (!provider.phone)
                    provider.phone = '*99#';
                if (!provider.username)
                    provider.username = '';
                if (!provider.password)
                    provider.password = '';
                var setprovider = {
                    apn: provider.apn,
                    phone: provider.phone,
                    username: provider.username,
                    password: provider.password
                };
                if (device) {
                    setprov(this.configFilePath, setprovider).then(function () {
                        lsusbdev().then(function (data) {
                            var devto = false;
                            for (var i = 0; i < data.length; i++) {
                                var usb = data[i];
                                if (usb.type == 'serial' && usb.hub == device && !devto) {
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
                else {
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
            }
            else {
                reject({ error: 'must push a provider' });
            }
        });
    };
    ;
    return WvDial;
})();

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImluZGV4LnRzIl0sIm5hbWVzIjpbInNldHN0cmluZyIsImdldHN0cmluZyIsImFsbHN0cmluZ3MiLCJjb25uZWN0Iiwid3Zjb25uZWN0Iiwic2V0cHJvdiIsImNvbnN0cnVjdG9yIiwic2V0VXNiIiwic2V0UHJvdmlkZXIiLCJnZXRDb25maWciLCJzZXRQYXJhbSIsImdldFBhcmFtIiwic3RhdHVzIiwic2V0ZGV2IiwiY29uZmlndXJlIl0sIm1hcHBpbmdzIjoiQUFBQSxJQUFZLE9BQU8sV0FBTSxVQUFVLENBQUMsQ0FBQTtBQUVwQyxJQUFZLEVBQUUsV0FBTSxJQUFJLENBQUMsQ0FBQTtBQUN6QixJQUFPLFFBQVEsV0FBVyxVQUFVLENBQUMsQ0FBQztBQUN0QyxJQUFJLFNBQVMsR0FBRyxPQUFPLENBQUMsV0FBVyxDQUFDLENBQUM7QUFFckMsSUFBSSxJQUFJLEdBQUcsT0FBTyxDQUFDLGVBQWUsQ0FBQyxDQUFDO0FBQ3BDLElBQUksSUFBSSxHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQztBQUVsQyxJQUFJLElBQUksR0FBRyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUM7QUFFNUIsSUFBSSxZQUFZLEdBQUcsS0FBSyxDQUFDO0FBU3hCLENBQUM7QUF5QkYsbUJBQW1CLGNBQXNCLEVBQUUsR0FBRyxFQUFFLEdBQUc7SUFFL0NBLE1BQU1BLENBQUNBLElBQUlBLE9BQU9BLENBQXdCQSxVQUFTQSxPQUFPQSxFQUFFQSxNQUFNQTtRQUM5RCxTQUFTLENBQUMsY0FBYyxFQUFFLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFTLFNBQWlCO1lBQzFELElBQUksQ0FBQyxlQUFlLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsRUFBRSxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsS0FBSyxHQUFHLFNBQVMsQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUs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R0wsYUFBQztBQUFELENBdE5RLEFBc05QLEdBQUEsQ0FBQyIsImZpbGUiOiJpbmRleC5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIFByb21pc2UgZnJvbSBcImJsdWViaXJkXCI7XG5pbXBvcnQgKiBhcyBwYXRoRXhpc3RzIGZyb20gXCJwYXRoLWV4aXN0c1wiO1xuaW1wb3J0ICogYXMgZnMgZnJvbSBcImZzXCI7XG5pbXBvcnQgbHN1c2JkZXYgPSByZXF1aXJlKFwibHN1c2JkZXZcIik7XG5sZXQgaHdyZXN0YXJ0ID0gcmVxdWlyZSgnaHdyZXN0YXJ0Jyk7XG5cbmxldCBleGVjID0gcmVxdWlyZSgncHJvbWlzZWQtZXhlYycpO1xubGV0IFRhaWwgPSByZXF1aXJlKCdhbHdheXMtdGFpbCcpO1xuXG5sZXQgdmVyYiA9IHJlcXVpcmUoJ3ZlcmJvJyk7XG5cbmxldCBtb2JpbGVzdGF0dXMgPSBmYWxzZTtcblxuLy9zcGF3biA9IHJlcXVpcmUoJ2NoaWxkX3Byb2Nlc3MnKS5zcGF3bixcblxuXG5pbnRlcmZhY2UgSUNvbmZPcHQge1xuICAgIHZlcmJvc2U/OiBib29sZWFuO1xuICAgIGRldj86IGFueTtcbiAgICBwcm92aWRlcjogSVByb3ZpZGVyQ0Y7XG59O1xuXG5cbmludGVyZmFjZSBJUHJvdmlkZXJDRiB7XG5cbiAgICBsYWJlbD86IHN0cmluZztcbiAgICBhcG46IHN0cmluZztcbiAgICBwaG9uZT86IHN0cmluZztcbiAgICB1c2VybmFtZT86IHN0cmluZztcbiAgICBwYXNzd29yZD86IHN0cmluZztcblxufVxuaW50ZXJmYWNlIElQcm92aWRlciB7XG5cbiAgICBsYWJlbD86IHN0cmluZztcbiAgICBhcG46IHN0cmluZztcbiAgICBwaG9uZTogc3RyaW5nO1xuICAgIHVzZXJuYW1lOiBzdHJpbmc7XG4gICAgcGFzc3dvcmQ6IHN0cmluZztcblxufVxuLy8gbW9kcHJvYmUgdXNic2VyaWFsXG4vLyB3dmRpYWxjb25mXG4vLyB3dmRpYWwgRGVmYXVsdHMgMT4vZGV2L251bGwgMj4vZGV2L251bGxcblxuZnVuY3Rpb24gc2V0c3RyaW5nKGNvbmZpZ0ZpbGVQYXRoOiBzdHJpbmcsIGtleSwgdmFsKSB7XG5cbiAgICByZXR1cm4gbmV3IFByb21pc2U8eyBzdWNjZXNzPzogYm9vbGVhbiB9PihmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgZ2V0c3RyaW5nKGNvbmZpZ0ZpbGVQYXRoLCBrZXkpLnRoZW4oZnVuY3Rpb24ob2xkc3RyaW5nOiBzdHJpbmcpIHtcbiAgICAgICAgICAgIGV4ZWMoJ3NlZCAtaSAtZSBcInMvJyArIGtleVswXS50b1VwcGVyQ2FzZSgpICsga2V5LnNsaWNlKDEpICsgJyA9ICcgKyBvbGRzdHJpbmcucmVwbGFjZSgvXFwnL2csICdcXFxcXCInKS5yZXBsYWNlKC9cXC8vZywgJ1xcXFxcXC8nKSArICcvJyArIGtleVswXS50b1VwcGVyQ2FzZSgpICsga2V5LnNsaWNlKDEpICsgJyA9ICcgKyB2YWwucmVwbGFjZSgvXFxcIi9nLCAnXFxcXFwiJykucmVwbGFjZSgvXFwvL2csICdcXFxcXFwvJykgKyAnL2dcIiAnICsgY29uZmlnRmlsZVBhdGggKyAnJykudGhlbihmdW5jdGlvbihzdGRvdXQpIHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKHsgc3VjY2VzczogdHJ1ZSB9KTtcbiAgICAgICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgICAgIHJlamVjdCh7IGVycm9yOiBlcnIgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICByZWplY3QoeyBlcnJvcjogZXJyIH0pO1xuICAgICAgICB9KTtcbiAgICB9KTtcbn1cbmZ1bmN0aW9uIGdldHN0cmluZyhjb25maWdGaWxlUGF0aDogc3RyaW5nLCBwYXJhbSkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgYWxsc3RyaW5ncyhjb25maWdGaWxlUGF0aCkudGhlbihmdW5jdGlvbihkYXRhKSB7XG4gICAgICAgICAgICBsZXQgdGVzdCA9IGZhbHNlO1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBPYmplY3Qua2V5cyhkYXRhKS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGlmIChPYmplY3Qua2V5cyhkYXRhKVtpXSA9PSAocGFyYW1bMF0udG9VcHBlckNhc2UoKSArIHBhcmFtLnNsaWNlKDEpKSkge1xuICAgICAgICAgICAgICAgICAgICB0ZXN0ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShkYXRhW09iamVjdC5rZXlzKGRhdGEpW2ldXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCF0ZXN0KSB7XG4gICAgICAgICAgICAgICAgcmVqZWN0KHsgZXJyb3I6IFwid3JvbmcgcGFyYW1cIiB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICByZWplY3QoeyBlcnJvcjogZXJyIH0pO1xuICAgICAgICB9KVxuICAgIH0pXG59XG5mdW5jdGlvbiBhbGxzdHJpbmdzKGNvbmZpZ0ZpbGVQYXRoOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG5cbiAgICAgICAgZXhlYyhfX2Rpcm5hbWUgKyAnL3d2ZGlhbC5zaCAgLXQgXCJnZXRcIiAtY1wiJyArIGNvbmZpZ0ZpbGVQYXRoICsgJ1wiJykudGhlbihmdW5jdGlvbihkYXRhKSB7XG4gICAgICAgICAgICByZXNvbHZlKEpTT04ucGFyc2UoZGF0YSkpO1xuICAgICAgICB9KS5jYXRjaChmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICB9KVxuICAgIH0pXG59XG5cbmZ1bmN0aW9uIGNvbm5lY3QoY29uZmlnRmlsZVBhdGg6IHN0cmluZywgd2F0Y2g/OiBib29sZWFuLCBkZXZpY2U/OiBzdHJpbmcpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2U8Ym9vbGVhbj4oZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG5cblxuICAgICAgICBjb25zb2xlLmxvZyhkZXZpY2UpXG5cbiAgICAgICAgbGV0IGV4aXN0ID0gZmFsc2U7XG4gICAgICAgIGxzdXNiZGV2KCkudGhlbihmdW5jdGlvbihkYXRhOiBbeyB0eXBlOiBzdHJpbmcsIGRldjogc3RyaW5nLCBwcm9kdWN0OiBzdHJpbmcsIGh1Yjogc3RyaW5nLCBpZDogc3RyaW5nIH1dKSB7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICB2YXIgdXNiID0gZGF0YVtpXTtcbiAgICAgICAgICAgICAgICBpZiAodXNiLnR5cGUgPT0gJ3NlcmlhbCcgJiYgKGRldmljZSAmJiB1c2IuaHViID09IGRldmljZSkgfHwgIWRldmljZSkge1xuICAgICAgICAgICAgICAgICAgICBleGlzdCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwicGFzczFcIilcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfSlcblxuICAgICAgICBpZiAoIWV4aXN0KSBod3Jlc3RhcnQoXCJyZWJvb3RcIilcbiAgICAgICAgXG4gICAgICAgIC8vIGNoZWNrIGlmIHd2ZGlhbC5jb25mIHVzYiBpcyBwcmVzZW50XG4gICAgICAgIGNvbnNvbGUubG9nKGNvbmZpZ0ZpbGVQYXRoKVxuXG5cbiAgICAgICAgbGV0IHd2ZGlhbGVyciA9IFwiL3RtcC9XdmRpYWwuZXJyXCJcbiAgICAgICAgbGV0IHd2ZGlhbG91dCA9IFwiL3RtcC9XdmRpYWwub3V0XCJcblxuICAgICAgICBsZXQgbG5jb3VudCA9IDA7XG5cbiAgICAgICAgZnVuY3Rpb24gd3Zjb25uZWN0KCkge1xuICAgICAgICAgICAgbW9iaWxlc3RhdHVzID0gZmFsc2U7XG4gICAgICAgICAgICBpZiAobG5jb3VudCA+IDIwMCkge1xuXG5cblxuICAgICAgICAgICAgICAgIGlmICghd2F0Y2gpIHtcbiAgICAgICAgICAgICAgICAgICAgdGFpbC51bndhdGNoKCk7XG4gICAgICAgICAgICAgICAgICAgIHJlamVjdCh0cnVlKTtcblxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwicmVib290XCIpXG4gICAgICAgICAgICAgICAgICAgIGh3cmVzdGFydChcInVucGx1Z1wiKTtcbiAgICAgICAgICAgICAgICB9XG5cblxuXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoZGV2aWNlKSB7XG5cblxuICAgICAgICAgICAgICAgIGxzdXNiZGV2KCkudGhlbihmdW5jdGlvbihkYXRhKSB7XG4gICAgICAgICAgICAgICAgICAgIGxldCBkZXZ0bzogYW55ID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHVzYiA9IGRhdGFbaV07XG5cblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHVzYi50eXBlID09ICdzZXJpYWwnICYmIHVzYi5odWIgPT0gZGV2aWNlICYmICFkZXZ0bykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdzZXQgJyArIHVzYi5kZXYpXG5cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRldnRvID0gdXNiLmRldjtcblxuXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cblxuXG4gICAgICAgICAgICAgICAgICAgIGlmIChkZXZ0bykge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2V0c3RyaW5nKGNvbmZpZ0ZpbGVQYXRoLCAnTW9kZW0nLCBkZXZ0bykudGhlbihmdW5jdGlvbigpIHtcblxuXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBleGVjKCdwa2lsbCB3dmRpYWwgJiYgc2xlZXAgNSA7IG1vZHByb2JlIHVzYnNlcmlhbCcpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV4ZWMoJ3NsZWVwIDU7IHd2ZGlhbCBEZWZhdWx0cyAtQyAnICsgY29uZmlnRmlsZVBhdGggKyAnIDE+JyArIHd2ZGlhbGVyciArICcgMj4nICsgd3ZkaWFsb3V0KS5jYXRjaChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxuY291bnQgPSBsbmNvdW50ICsgNjBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHd2Y29ubmVjdCgpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhsbmNvdW50KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KS5jYXRjaChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXhlYygnc2xlZXAgNTsgd3ZkaWFsIERlZmF1bHRzIC1DICcgKyBjb25maWdGaWxlUGF0aCArICcgMT4nICsgd3ZkaWFsZXJyICsgJyAyPicgKyB3dmRpYWxvdXQpLmNhdGNoKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG5jb3VudCA9IGxuY291bnQgKyA2MFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgd3Zjb25uZWN0KClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGxuY291bnQpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24oZXJyKSB7XG5cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGVyciArIFwiIHNldCBzdHJpbmcgZXJyb3JcIilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsbmNvdW50ID0gbG5jb3VudCArIDMwXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgd3Zjb25uZWN0KClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhsbmNvdW50KVxuXG5cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIiBlcnIyXCIpXG4gICAgICAgICAgICAgICAgICAgICAgICBsbmNvdW50ID0gbG5jb3VudCArIDMwXG4gICAgICAgICAgICAgICAgICAgICAgICB3dmNvbm5lY3QoKVxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2cobG5jb3VudClcblxuXG5cbiAgICAgICAgICAgICAgICAgICAgfVxuXG5cbiAgICAgICAgICAgICAgICB9KS5jYXRjaChmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgbG5jb3VudCA9IGxuY291bnQgKyA2MFxuICAgICAgICAgICAgICAgICAgICB3dmNvbm5lY3QoKVxuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhsbmNvdW50KVxuXG4gICAgICAgICAgICAgICAgfSk7XG5cblxuICAgICAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgICAgIGV4ZWMoJ3BraWxsIHd2ZGlhbCAmJiBzbGVlcCA1IDsgbW9kcHJvYmUgdXNic2VyaWFsJykudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgZXhlYygnc2xlZXAgNTsgd3ZkaWFsIERlZmF1bHRzIC1DICcgKyBjb25maWdGaWxlUGF0aCArICcgMT4nICsgd3ZkaWFsZXJyICsgJyAyPicgKyB3dmRpYWxvdXQpLmNhdGNoKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG5jb3VudCA9IGxuY291bnQgKyA2MFxuICAgICAgICAgICAgICAgICAgICAgICAgd3Zjb25uZWN0KClcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGxuY291bnQpXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICBleGVjKCdzbGVlcCA1OyB3dmRpYWwgRGVmYXVsdHMgLUMgJyArIGNvbmZpZ0ZpbGVQYXRoICsgJyAxPicgKyB3dmRpYWxlcnIgKyAnIDI+JyArIHd2ZGlhbG91dCkuY2F0Y2goZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsbmNvdW50ID0gbG5jb3VudCArIDYwXG4gICAgICAgICAgICAgICAgICAgICAgICB3dmNvbm5lY3QoKVxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2cobG5jb3VudClcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG5cbiAgICAgICAgZnMud3JpdGVGaWxlU3luYyh3dmRpYWxlcnIsIFwiXCIpO1xuXG4gICAgICAgIGZzLndyaXRlRmlsZVN5bmMod3ZkaWFsb3V0LCBcIlwiKTtcblxuXG5cbiAgICAgICAgdmFyIHRhaWwgPSBuZXcgVGFpbCh3dmRpYWxvdXQsICdcXG4nKTtcblxuICAgICAgICB0YWlsLm9uKCdsaW5lJywgZnVuY3Rpb24oZGF0YSkge1xuXG4gICAgICAgICAgICBsbmNvdW50ID0gbG5jb3VudCArIDE7XG5cblxuICAgICAgICAgICAgaWYgKGRhdGEuc3BsaXQoXCJETlNcIikubGVuZ3RoID09IDIpIHtcbiAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgLy8gICBleGVjKCdpcCByb3V0ZSBhZGQgZGVmYXVsdCBkZXYgcHBwMCcpXG4gICAgICAgICAgICAgICAgLy8gfSwgMzAwMDApO1xuICAgICAgICAgICAgICAgIG1vYmlsZXN0YXR1cyA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKHd2ZGlhbGVyciwgXCJcIik7XG5cbiAgICAgICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKHd2ZGlhbG91dCwgXCJcIik7XG5cbiAgICAgICAgICAgICAgICBsbmNvdW50ID0gMDtcblxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdwcHAgY29ubmVjdGVkJylcblxuICAgICAgICAgICAgLy8gICAgaWYgKCF3YXRjaCkge1xuICAgICAgICAgICAgLy8gICAgICAgIHRhaWwudW53YXRjaCgpO1xuICAgICAgICAgICAgIC8vICAgICAgIHJlc29sdmUodHJ1ZSk7XG5cbiAgICAgICAgICAgIC8vICAgIH1cblxuXG5cbiAgICAgICAgICAgIH0gZWxzZSBpZiAobG5jb3VudCA+IDIwMCkge1xuICAgICAgICAgICAgICAgIG1vYmlsZXN0YXR1cyA9IGZhbHNlO1xuXG4gICAgICAgICAgICAgICAgaWYgKCF3YXRjaCkge1xuICAgICAgICAgICAgICAgICAgICB0YWlsLnVud2F0Y2goKTtcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KHRydWUpO1xuXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaHdyZXN0YXJ0KFwidW5wbHVnXCIpO1xuICAgICAgICAgICAgICAgIH1cblxuXG5cblxuXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfSk7XG5cblxuICAgICAgICB0YWlsLm9uKCdlcnJvcicsIGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwidGFpbGVycm9yXCIpO1xuXG5cbiAgICAgICAgICAgIGlmICghd2F0Y2gpIHtcbiAgICAgICAgICAgICAgICB0YWlsLnVud2F0Y2goKTtcbiAgICAgICAgICAgICAgICByZWplY3QodHJ1ZSk7XG5cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaHdyZXN0YXJ0KFwidW5wbHVnXCIpO1xuICAgICAgICAgICAgfVxuXG5cblxuXG5cblxuICAgICAgICB9KTtcblxuICAgICAgICB0YWlsLndhdGNoKCk7XG5cbiAgICAgICAgd3Zjb25uZWN0KClcblxuXG5cblxuXG5cblxuXG5cbiAgICB9KVxufVxuXG5cbmZ1bmN0aW9uIHNldHByb3YoY29uZmlnRmlsZVBhdGgsIHByb3ZpZGVyOiBJUHJvdmlkZXJDRikge1xuXG5cblxuXG4gICAgaWYgKCFwcm92aWRlci5waG9uZSkgcHJvdmlkZXIucGhvbmUgPSAnKjk5Iyc7XG4gICAgaWYgKCFwcm92aWRlci51c2VybmFtZSkgcHJvdmlkZXIudXNlcm5hbWUgPSAnJztcbiAgICBpZiAoIXByb3ZpZGVyLnBhc3N3b3JkKSBwcm92aWRlci5wYXNzd29yZCA9ICcnO1xuXG5cbiAgICB0aGlzLnByb3ZpZGVyID0gcHJvdmlkZXI7XG5cbiAgICByZXR1cm4gbmV3IFByb21pc2U8eyBzdWNjZXNzPzogYm9vbGVhbiB9PihmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgaWYgKHByb3ZpZGVyLmFwbikge1xuICAgICAgICAgICAgc2V0c3RyaW5nKGNvbmZpZ0ZpbGVQYXRoLCAnSW5pdDMnLCAnQVQrQ0dEQ09OVD0xLFwiaXBcIixcIicgKyBwcm92aWRlci5hcG4gKyAnXCIsLDAsMCcpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ29rIGFwbicpO1xuICAgICAgICAgICAgICAgIGlmIChwcm92aWRlci5waG9uZSkge1xuICAgICAgICAgICAgICAgICAgICBzZXRzdHJpbmcoY29uZmlnRmlsZVBhdGgsICdQaG9uZScsIHByb3ZpZGVyLnBob25lKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHByb3ZpZGVyLnVzZXJuYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgIHNldHN0cmluZyhjb25maWdGaWxlUGF0aCwgJ1VzZXJuYW1lJywgcHJvdmlkZXIudXNlcm5hbWUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAocHJvdmlkZXIucGFzc3dvcmQpIHtcbiAgICAgICAgICAgICAgICAgICAgc2V0c3RyaW5nKGNvbmZpZ0ZpbGVQYXRoLCAnUGFzc3dvcmQnLCBwcm92aWRlci5wYXNzd29yZCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJlc29sdmUoeyBzdWNjZXNzOiB0cnVlIH0pO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJlamVjdChcIm5vIGFwblwiKTtcbiAgICAgICAgfVxuICAgIH0pXG5cbn07XG5cblxuZXhwb3J0ID1jbGFzcyBXdkRpYWwge1xuICAgIGNvbmZpZ0ZpbGVQYXRoOiBzdHJpbmc7XG4gICAgcHJvdmlkZXI6IElQcm92aWRlckNGO1xuICAgIGRldmljZTogYW55O1xuICAgIGNvbnN0cnVjdG9yKHBhdGg6IHN0cmluZywgZGV2aWNlPzogc3RyaW5nKSB7XG4gICAgICAgIGlmIChwYXRoKSB7XG4gICAgICAgICAgICB0aGlzLmNvbmZpZ0ZpbGVQYXRoID0gcGF0aDsgLy8gL2V0Yy93dmRpYWwuY29uZlxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5jb25maWdGaWxlUGF0aCA9ICcvZXRjL3d2ZGlhbC5jb25mJztcbiAgICAgICAgfVxuICAgICAgICBpZiAoZGV2aWNlKSB7XG4gICAgICAgICAgICB0aGlzLmRldmljZSA9IGRldmljZTsgLy8gL2V0Yy93dmRpYWwuY29uZlxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5kZXZpY2UgPSBmYWxzZTsgLy8gL2V0Yy93dmRpYWwuY29uZlxuICAgICAgICB9XG4gICAgfTtcblxuICAgIGNvbm5lY3Qod2F0Y2g/OiBib29sZWFuKSB7XG4gICAgICAgIGxldCBjb25maWdGaWxlUGF0aCA9IHRoaXMuY29uZmlnRmlsZVBhdGg7XG4gICAgICAgIGxldCBkZXYgPSB0aGlzLmRldmljZTtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlPGJvb2xlYW4+KGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ2Nvbm5lY3Rpb24nKTtcblxuICAgICAgICAgICAgZ2V0c3RyaW5nKGNvbmZpZ0ZpbGVQYXRoLCAnTW9kZW0nKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIGNvbm5lY3QoY29uZmlnRmlsZVBhdGgsIHdhdGNoLCBkZXYpLnRoZW4oZnVuY3Rpb24oYW5zd2VyKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoYW5zd2VyKTtcbiAgICAgICAgICAgICAgICB9KS5jYXRjaChmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHJlamVjdCgnZXJyMScpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pXG4gICAgfTtcblxuICAgIHNldFVzYihkZXZpY2U6IHN0cmluZykge1xuICAgICAgICBsZXQgY29uZmlnRmlsZVBhdGggPSB0aGlzLmNvbmZpZ0ZpbGVQYXRoO1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2U8eyBzdWNjZXNzPzogYm9vbGVhbiB9PihmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcblxuICAgICAgICAgICAgaWYgKGRldmljZSkge1xuICAgICAgICAgICAgICAgIHNldHN0cmluZyhjb25maWdGaWxlUGF0aCwgJ01vZGVtJywgZGV2aWNlLnJlcGxhY2UoL1xcLy9nLCAnXFxcXFxcLycpKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHsgc3VjY2VzczogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICB9KS5jYXRjaChmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG5cbiAgICAgICAgICAgICAgICB9KTtcblxuXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJlamVjdCh7IGVycm9yOiBcIk5vIGRldmljZSBcIiArIGRldmljZSArIFwiIGZvdW5kZWRcIiB9KTtcblxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuICAgIH07XG5cbiAgICBzZXRQcm92aWRlcihwcm92aWRlcjogSVByb3ZpZGVyQ0YpIHtcbiAgICAgICAgcmV0dXJuIHNldHByb3YodGhpcy5jb25maWdGaWxlUGF0aCwgcHJvdmlkZXIpXG5cbiAgICB9O1xuXG4gICAgZ2V0Q29uZmlnKCkge1xuICAgICAgICByZXR1cm4gYWxsc3RyaW5ncyh0aGlzLmNvbmZpZ0ZpbGVQYXRoKTtcbiAgICB9O1xuXG4gICAgc2V0UGFyYW0oa2V5OiBzdHJpbmcsIHZhbDogc3RyaW5nKSB7XG4gICAgICAgIHJldHVybiBzZXRzdHJpbmcodGhpcy5jb25maWdGaWxlUGF0aCwga2V5LCB2YWwpO1xuICAgIH07XG5cbiAgICBnZXRQYXJhbShwYXJhbTogc3RyaW5nKSB7XG4gICAgICAgIHJldHVybiBnZXRzdHJpbmcodGhpcy5jb25maWdGaWxlUGF0aCwgcGFyYW0pO1xuICAgIH07XG5cbiAgICBzdGF0dXMoKSB7XG5cbiAgICAgICAgcmV0dXJuIG1vYmlsZXN0YXR1c1xuXG4gICAgfVxuICAgIHNldGRldihkZXZpY2U6IHN0cmluZykge1xuICAgICAgICBsZXQgc2V0ZGV2ID0gdGhpcy5kZXZpY2U7XG4gICAgICAgIGxldCBjb25maWdGaWxlUGF0aCA9IHRoaXMuY29uZmlnRmlsZVBhdGg7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZTx7IHN1Y2Nlc3M/OiBib29sZWFuIH0+KGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAgICAgbHN1c2JkZXYoKS50aGVuKGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgICAgICAgICBsZXQgZGV2dG86IGFueSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICB2YXIgdXNiID0gZGF0YVtpXTtcblxuXG4gICAgICAgICAgICAgICAgICAgIGlmICh1c2IudHlwZSA9PSAnc2VyaWFsJyAmJiB1c2IuaHViID09IGRldmljZSAmJiAhZGV2dG8pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdzZXQgJyArIHVzYi5kZXYpXG5cblxuICAgICAgICAgICAgICAgICAgICAgICAgZGV2dG8gPSB1c2IuZGV2O1xuXG5cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuXG4gICAgICAgICAgICAgICAgaWYgKGRldnRvKSB7XG4gICAgICAgICAgICAgICAgICAgIHNldHN0cmluZyhjb25maWdGaWxlUGF0aCwgJ01vZGVtJywgZGV2dG8pLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZXRkZXYgPSBkZXZpY2U7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHsgc3VjY2VzczogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoeyBlcnJvcjogJ2Vycm9yIG9uIHNldHN0cmluZyAnIH0pO1xuICAgICAgICAgICAgICAgICAgICB9KVxuXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgICAgICAgICByZWplY3QoeyBlcnJvcjogJ2Vycm9yIG9uIG1vZGVtICcgfSk7XG5cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIH0pXG5cbiAgICAgICAgfSlcblxuICAgIH1cbiAgICBjb25maWd1cmUocHJvdmlkZXI6IElQcm92aWRlckNGKSB7XG4gICAgICAgIGxldCBkZXZpY2UgPSB0aGlzLmRldmljZTtcbiAgICAgICAgbGV0IGNvbmZpZ0ZpbGVQYXRoID0gdGhpcy5jb25maWdGaWxlUGF0aDtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlPHsgc3VjY2Vzcz86IGJvb2xlYW4gfT4oZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgICAgICBpZiAocHJvdmlkZXIpIHtcbiAgICAgICAgICAgICAgICBcbiAgICAgICBcbiAgICAgICAgICAgICAgICBpZiAoIXByb3ZpZGVyLnBob25lKSBwcm92aWRlci5waG9uZSA9ICcqOTkjJztcbiAgICAgICAgICAgICAgICBpZiAoIXByb3ZpZGVyLnVzZXJuYW1lKSBwcm92aWRlci51c2VybmFtZSA9ICcnO1xuICAgICAgICAgICAgICAgIGlmICghcHJvdmlkZXIucGFzc3dvcmQpIHByb3ZpZGVyLnBhc3N3b3JkID0gJyc7XG4gICAgICAgICBsZXQgc2V0cHJvdmlkZXI6SVByb3ZpZGVyPXtcbiAgICAgICAgICAgICAgICAgICAgYXBuOnByb3ZpZGVyLmFwbixcbiAgICAgICAgICAgICAgICAgICAgcGhvbmU6cHJvdmlkZXIucGhvbmUsXG4gICAgICAgICAgICAgICAgICAgIHVzZXJuYW1lOnByb3ZpZGVyLnVzZXJuYW1lLFxuICAgICAgICAgICAgICAgICAgICBwYXNzd29yZDpwcm92aWRlci5wYXNzd29yZFxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgaWYgKGRldmljZSkge1xuXG4gICAgICAgICAgICAgICAgICAgIHNldHByb3YodGhpcy5jb25maWdGaWxlUGF0aCwgc2V0cHJvdmlkZXIpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsc3VzYmRldigpLnRoZW4oZnVuY3Rpb24oZGF0YSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCBkZXZ0bzogYW55ID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBkYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciB1c2IgPSBkYXRhW2ldO1xuXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHVzYi50eXBlID09ICdzZXJpYWwnICYmIHVzYi5odWIgPT0gZGV2aWNlICYmICFkZXZ0bykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ3NldCAnICsgdXNiLmRldilcblxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXZ0byA9IHVzYi5kZXY7XG5cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZGV2dG8pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2V0c3RyaW5nKGNvbmZpZ0ZpbGVQYXRoLCAnTW9kZW0nLCBkZXZ0bykudGhlbihmdW5jdGlvbigpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh7IHN1Y2Nlc3M6IHRydWUgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KHsgZXJyb3I6ICdlcnJvciBvbiBzZXRzdHJpbmcgJyB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KHsgZXJyb3I6ICdlcnJvciBvbiBtb2RlbSAnIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuXG4gICAgICAgICAgICAgICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KHsgZXJyb3I6ICdlcnJvciBvbiBzZXRwcm92ICcgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0pXG5cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAgICAgICAgIGV4ZWMoJ2VjaG8gXCJbRGlhbGVyIERlZmF1bHRzXVwiID4gJyArIGNvbmZpZ0ZpbGVQYXRoKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZXhlYygnZWNobyBcXCdJbml0MyA9IEFUK0NHRENPTlQ9MSxcImlwXCIsXCInICsgcHJvdmlkZXIuYXBuICsgJ1wiLCwwLDBcXCcgPj4gJyArIGNvbmZpZ0ZpbGVQYXRoKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV4ZWMoJ2VjaG8gXCJQaG9uZSA9ICcgKyBwcm92aWRlci5waG9uZSArICdcIiA+PiAnICsgY29uZmlnRmlsZVBhdGgpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV4ZWMoJ2VjaG8gXCJVc2VybmFtZSA9ICcgKyBwcm92aWRlci51c2VybmFtZSArICdcIiA+PiAnICsgY29uZmlnRmlsZVBhdGgpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBleGVjKCdlY2hvIFwiUGFzc3dvcmQgPSAnICsgcHJvdmlkZXIucGFzc3dvcmQgKyAnXCIgPj4gJyArIGNvbmZpZ0ZpbGVQYXRoKS50aGVuKGZ1bmN0aW9uKCkge1xuXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBleGVjKCd3dmRpYWxjb25mICcgKyBjb25maWdGaWxlUGF0aCkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh7IHN1Y2Nlc3M6IHRydWUgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdCh7IGVycm9yOiAnZXJyb3Igb24gbW9kZW0gJyB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KVxuXG5cblxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuXG4gICAgICAgICAgICAgICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KHsgZXJyb3I6ICdlcnJvciBvbiBvcGVuICcgKyBjb25maWdGaWxlUGF0aCB9KTtcblxuICAgICAgICAgICAgICAgICAgICB9KTtcblxuXG4gICAgICAgICAgICAgICAgfVxuXG5cblxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZWplY3QoeyBlcnJvcjogJ211c3QgcHVzaCBhIHByb3ZpZGVyJyB9KTtcblxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuICAgIH07XG5cblxufTtcbiJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==
