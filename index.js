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
            hwrestart("unplug");
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
                        resolve(answer);
                    }
                    else {
                        hwrestart("unplug");
                    }
                }).catch(function (err) {
                    if (!watch) {
                        reject('rrrrrr');
                    }
                    else {
                        hwrestart("unplug");
                    }
                });
            }).catch(function () {
                if (!watch) {
                    reject('errrr');
                }
                else {
                    hwrestart("unplug");
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
})();

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImluZGV4LnRzIl0sIm5hbWVzIjpbInNldHN0cmluZyIsImdldHN0cmluZyIsImFsbHN0cmluZ3MiLCJjb25uZWN0Iiwid3Zjb25uZWN0Iiwic2V0cHJvdiIsImNvbnN0cnVjdG9yIiwic2V0VXNiIiwic2V0UHJvdmlkZXIiLCJnZXRDb25maWciLCJzZXRQYXJhbSIsImdldFBhcmFtIiwic3RhdHVzIiwic2V0ZGV2IiwiY29uZmlndXJlIl0sIm1hcHBpbmdzIjoiQUFBQSxJQUFZLE9BQU8sV0FBTSxVQUFVLENBQUMsQ0FBQTtBQUVwQyxJQUFZLEVBQUUsV0FBTSxJQUFJLENBQUMsQ0FBQTtBQUN6QixJQUFPLFFBQVEsV0FBVyxVQUFVLENBQUMsQ0FBQztBQUN0QyxJQUFJLFNBQVMsR0FBRyxPQUFPLENBQUMsV0FBVyxDQUFDLENBQUM7QUFFckMsSUFBSSxJQUFJLEdBQUcsT0FBTyxDQUFDLGVBQWUsQ0FBQyxDQUFDO0FBQ3BDLElBQUksSUFBSSxHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQztBQUVsQyxJQUFJLElBQUksR0FBRyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUM7QUFFNUIsSUFBSSxZQUFZLEdBQUcsS0FBSyxDQUFDO0FBU3hCLENBQUM7QUF5QkYsbUJBQW1CLGNBQXNCLEVBQUUsR0FBRyxFQUFFLEdBQUc7SUFFL0NBLE1BQU1BLENBQUNBLElBQUlBLE9BQU9BLENBQXdCQSxVQUFTQSxPQUFPQSxFQUFFQSxNQUFNQTtRQUM5RCxTQUFTLENBQUMsY0FBYyxFQUFFLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFTLFNBQWlCO1lBQzFELElBQUksQ0FBQyxlQUFlLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsRUFBRSxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsS0FBSyxHQUFHLFNBQVMsQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUs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USxHQUFHLE9BQU8sR0FBRyxjQUFjLENBQUMsQ0FBQyxJQUFJLENBQUM7d0NBRzFFLElBQUksQ0FBQyxhQUFhLEdBQUcsY0FBYyxDQUFDLENBQUMsSUFBSSxDQUFDOzRDQUN0QyxPQUFPLENBQUMsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQzt3Q0FDL0IsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLFVBQVMsR0FBRzs0Q0FDakIsTUFBTSxDQUFDLEVBQUUsS0FBSyxFQUFFLGlCQUFpQixFQUFFLENBQUMsQ0FBQzt3Q0FDekMsQ0FBQyxDQUFDLENBQUE7b0NBS04sQ0FBQyxDQUFDLENBQUE7Z0NBQ04sQ0FBQyxDQUFDLENBQUE7NEJBQ04sQ0FBQyxDQUFDLENBQUE7d0JBQ04sQ0FBQyxDQUFDLENBQUE7b0JBRU4sQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLFVBQVMsR0FBRzt3QkFDakIsTUFBTSxDQUFDLEVBQUUsS0FBSyxFQUFFLGdCQUFnQixHQUFHLGNBQWMsRUFBRSxDQUFDLENBQUM7b0JBRXpELENBQUMsQ0FBQyxDQUFDO2dCQUdQLENBQUM7Z0JBQUMsSUFBSSxDQUFDLENBQUM7b0JBQ0osTUFBTSxDQUFDLEVBQUUsS0FBSyxFQUFFLG9CQUFvQixFQUFFLENBQUMsQ0FBQztnQkFDNUMsQ0FBQztZQUlMLENBQUM7WUFBQyxJQUFJLENBQUMsQ0FBQztnQkFDSixNQUFNLENBQUMsRUFBRSxLQUFLLEVBQUUsc0JBQXNCLEVBQUUsQ0FBQyxDQUFDO1lBRTlDLENBQUM7UUFDTCxDQUFDLENBQUNBLENBQUFBO0lBQ05BLENBQUNBOztJQUdMLGFBQUM7QUFBRCxDQW5QUSxBQW1QUCxHQUFBLENBQUMiLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBQcm9taXNlIGZyb20gXCJibHVlYmlyZFwiO1xuaW1wb3J0ICogYXMgcGF0aEV4aXN0cyBmcm9tIFwicGF0aC1leGlzdHNcIjtcbmltcG9ydCAqIGFzIGZzIGZyb20gXCJmc1wiO1xuaW1wb3J0IGxzdXNiZGV2ID0gcmVxdWlyZShcImxzdXNiZGV2XCIpO1xubGV0IGh3cmVzdGFydCA9IHJlcXVpcmUoJ2h3cmVzdGFydCcpO1xuXG5sZXQgZXhlYyA9IHJlcXVpcmUoJ3Byb21pc2VkLWV4ZWMnKTtcbmxldCBUYWlsID0gcmVxdWlyZSgnYWx3YXlzLXRhaWwnKTtcblxubGV0IHZlcmIgPSByZXF1aXJlKCd2ZXJibycpO1xuXG5sZXQgbW9iaWxlc3RhdHVzID0gZmFsc2U7XG5cbi8vc3Bhd24gPSByZXF1aXJlKCdjaGlsZF9wcm9jZXNzJykuc3Bhd24sXG5cblxuaW50ZXJmYWNlIElDb25mT3B0IHtcbiAgICB2ZXJib3NlPzogYm9vbGVhbjtcbiAgICBkZXY/OiBhbnk7XG4gICAgcHJvdmlkZXI6IElQcm92aWRlckNGO1xufTtcblxuXG5pbnRlcmZhY2UgSVByb3ZpZGVyQ0Yge1xuXG4gICAgbGFiZWw/OiBzdHJpbmc7XG4gICAgYXBuOiBzdHJpbmc7XG4gICAgcGhvbmU/OiBzdHJpbmc7XG4gICAgdXNlcm5hbWU/OiBzdHJpbmc7XG4gICAgcGFzc3dvcmQ/OiBzdHJpbmc7XG5cbn1cbmludGVyZmFjZSBJUHJvdmlkZXIge1xuXG4gICAgbGFiZWw/OiBzdHJpbmc7XG4gICAgYXBuOiBzdHJpbmc7XG4gICAgcGhvbmU6IHN0cmluZztcbiAgICB1c2VybmFtZTogc3RyaW5nO1xuICAgIHBhc3N3b3JkOiBzdHJpbmc7XG5cbn1cbi8vIG1vZHByb2JlIHVzYnNlcmlhbFxuLy8gd3ZkaWFsY29uZlxuLy8gd3ZkaWFsIERlZmF1bHRzIDE+L2Rldi9udWxsIDI+L2Rldi9udWxsXG5cbmZ1bmN0aW9uIHNldHN0cmluZyhjb25maWdGaWxlUGF0aDogc3RyaW5nLCBrZXksIHZhbCkge1xuXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPHsgc3VjY2Vzcz86IGJvb2xlYW4gfT4oZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgIGdldHN0cmluZyhjb25maWdGaWxlUGF0aCwga2V5KS50aGVuKGZ1bmN0aW9uKG9sZHN0cmluZzogc3RyaW5nKSB7XG4gICAgICAgICAgICBleGVjKCdzZWQgLWkgLWUgXCJzLycgKyBrZXlbMF0udG9VcHBlckNhc2UoKSArIGtleS5zbGljZSgxKSArICcgPSAnICsgb2xkc3RyaW5nLnJlcGxhY2UoL1xcJy9nLCAnXFxcXFwiJykucmVwbGFjZSgvXFwvL2csICdcXFxcXFwvJykgKyAnLycgKyBrZXlbMF0udG9VcHBlckNhc2UoKSArIGtleS5zbGljZSgxKSArICcgPSAnICsgdmFsLnJlcGxhY2UoL1xcXCIvZywgJ1xcXFxcIicpLnJlcGxhY2UoL1xcLy9nLCAnXFxcXFxcLycpICsgJy9nXCIgJyArIGNvbmZpZ0ZpbGVQYXRoICsgJycpLnRoZW4oZnVuY3Rpb24oc3Rkb3V0KSB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZSh7IHN1Y2Nlc3M6IHRydWUgfSk7XG4gICAgICAgICAgICB9KS5jYXRjaChmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgICAgICByZWplY3QoeyBlcnJvcjogZXJyIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgcmVqZWN0KHsgZXJyb3I6IGVyciB9KTtcbiAgICAgICAgfSk7XG4gICAgfSk7XG59XG5mdW5jdGlvbiBnZXRzdHJpbmcoY29uZmlnRmlsZVBhdGg6IHN0cmluZywgcGFyYW0pIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgIGFsbHN0cmluZ3MoY29uZmlnRmlsZVBhdGgpLnRoZW4oZnVuY3Rpb24oZGF0YSkge1xuICAgICAgICAgICAgbGV0IHRlc3QgPSBmYWxzZTtcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgT2JqZWN0LmtleXMoZGF0YSkubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAoT2JqZWN0LmtleXMoZGF0YSlbaV0gPT0gKHBhcmFtWzBdLnRvVXBwZXJDYXNlKCkgKyBwYXJhbS5zbGljZSgxKSkpIHtcbiAgICAgICAgICAgICAgICAgICAgdGVzdCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoZGF0YVtPYmplY3Qua2V5cyhkYXRhKVtpXV0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghdGVzdCkge1xuICAgICAgICAgICAgICAgIHJlamVjdCh7IGVycm9yOiBcIndyb25nIHBhcmFtXCIgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgcmVqZWN0KHsgZXJyb3I6IGVyciB9KTtcbiAgICAgICAgfSlcbiAgICB9KVxufVxuZnVuY3Rpb24gYWxsc3RyaW5ncyhjb25maWdGaWxlUGF0aDogc3RyaW5nKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuXG4gICAgICAgIGV4ZWMoX19kaXJuYW1lICsgJy93dmRpYWwuc2ggIC10IFwiZ2V0XCIgLWNcIicgKyBjb25maWdGaWxlUGF0aCArICdcIicpLnRoZW4oZnVuY3Rpb24oZGF0YSkge1xuICAgICAgICAgICAgcmVzb2x2ZShKU09OLnBhcnNlKGRhdGEpKTtcbiAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgfSlcbiAgICB9KVxufVxuXG5mdW5jdGlvbiBjb25uZWN0KGNvbmZpZ0ZpbGVQYXRoOiBzdHJpbmcsIHdhdGNoPzogYm9vbGVhbiwgZGV2aWNlPzogc3RyaW5nKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPGJvb2xlYW4+KGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuXG5cbiAgICAgICAgY29uc29sZS5sb2coZGV2aWNlKVxuXG4gICAgICAgIGxldCBleGlzdCA9IGZhbHNlO1xuICAgICAgICBsc3VzYmRldigpLnRoZW4oZnVuY3Rpb24oZGF0YTogW3sgdHlwZTogc3RyaW5nLCBkZXY6IHN0cmluZywgcHJvZHVjdDogc3RyaW5nLCBodWI6IHN0cmluZywgaWQ6IHN0cmluZyB9XSkge1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBkYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdmFyIHVzYiA9IGRhdGFbaV07XG4gICAgICAgICAgICAgICAgaWYgKHVzYi50eXBlID09ICdzZXJpYWwnICYmIChkZXZpY2UgJiYgdXNiLmh1YiA9PSBkZXZpY2UpIHx8ICFkZXZpY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgZXhpc3QgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcInBhc3MxXCIpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgIH0pXG5cbiAgICAgICAgaWYgKCFleGlzdCkgaHdyZXN0YXJ0KFwidW5wbHVnXCIpXG4gICAgICAgIFxuICAgICAgICAvLyBjaGVjayBpZiB3dmRpYWwuY29uZiB1c2IgaXMgcHJlc2VudFxuICAgICAgICBjb25zb2xlLmxvZyhjb25maWdGaWxlUGF0aClcblxuXG4gICAgICAgIGxldCB3dmRpYWxlcnIgPSBcIi90bXAvV3ZkaWFsLmVyclwiXG4gICAgICAgIGxldCB3dmRpYWxvdXQgPSBcIi90bXAvV3ZkaWFsLm91dFwiXG5cbiAgICAgICAgbGV0IGxuY291bnQgPSAwO1xuXG4gICAgICAgIGZ1bmN0aW9uIHd2Y29ubmVjdCgpIHtcbiAgICAgICAgICAgIG1vYmlsZXN0YXR1cyA9IGZhbHNlO1xuICAgICAgICAgICAgaWYgKGxuY291bnQgPiAyMDApIHtcblxuXG5cbiAgICAgICAgICAgICAgICBpZiAoIXdhdGNoKSB7XG4gICAgICAgICAgICAgICAgICAgIHRhaWwudW53YXRjaCgpO1xuICAgICAgICAgICAgICAgICAgICByZWplY3QodHJ1ZSk7XG5cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcInJlYm9vdFwiKVxuICAgICAgICAgICAgICAgICAgICBod3Jlc3RhcnQoXCJ1bnBsdWdcIik7XG4gICAgICAgICAgICAgICAgfVxuXG5cblxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGRldmljZSkge1xuXG5cbiAgICAgICAgICAgICAgICBsc3VzYmRldigpLnRoZW4oZnVuY3Rpb24oZGF0YSkge1xuICAgICAgICAgICAgICAgICAgICBsZXQgZGV2dG86IGFueSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciB1c2IgPSBkYXRhW2ldO1xuXG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh1c2IudHlwZSA9PSAnc2VyaWFsJyAmJiB1c2IuaHViID09IGRldmljZSAmJiAhZGV2dG8pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnc2V0ICcgKyB1c2IuZGV2KVxuXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXZ0byA9IHVzYi5kZXY7XG5cblxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG5cblxuICAgICAgICAgICAgICAgICAgICBpZiAoZGV2dG8pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNldHN0cmluZyhjb25maWdGaWxlUGF0aCwgJ01vZGVtJywgZGV2dG8pLnRoZW4oZnVuY3Rpb24oKSB7XG5cblxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZXhlYygncGtpbGwgd3ZkaWFsICYmIHNsZWVwIDUgOyBtb2Rwcm9iZSB1c2JzZXJpYWwnKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBleGVjKCdzbGVlcCA1OyB3dmRpYWwgRGVmYXVsdHMgLUMgJyArIGNvbmZpZ0ZpbGVQYXRoICsgJyAxPicgKyB3dmRpYWxlcnIgKyAnIDI+JyArIHd2ZGlhbG91dCkuY2F0Y2goZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsbmNvdW50ID0gbG5jb3VudCArIDYwXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB3dmNvbm5lY3QoKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2cobG5jb3VudClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV4ZWMoJ3NsZWVwIDU7IHd2ZGlhbCBEZWZhdWx0cyAtQyAnICsgY29uZmlnRmlsZVBhdGggKyAnIDE+JyArIHd2ZGlhbGVyciArICcgMj4nICsgd3ZkaWFsb3V0KS5jYXRjaChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxuY291bnQgPSBsbmNvdW50ICsgNjBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHd2Y29ubmVjdCgpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhsbmNvdW50KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhlcnIgKyBcIiBzZXQgc3RyaW5nIGVycm9yXCIpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG5jb3VudCA9IGxuY291bnQgKyAzMFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHd2Y29ubmVjdCgpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2cobG5jb3VudClcblxuXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCIgZXJyMlwiKVxuICAgICAgICAgICAgICAgICAgICAgICAgbG5jb3VudCA9IGxuY291bnQgKyAzMFxuICAgICAgICAgICAgICAgICAgICAgICAgd3Zjb25uZWN0KClcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGxuY291bnQpXG5cblxuXG4gICAgICAgICAgICAgICAgICAgIH1cblxuXG4gICAgICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGxuY291bnQgPSBsbmNvdW50ICsgNjBcbiAgICAgICAgICAgICAgICAgICAgd3Zjb25uZWN0KClcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2cobG5jb3VudClcblxuICAgICAgICAgICAgICAgIH0pO1xuXG5cbiAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICBleGVjKCdwa2lsbCB3dmRpYWwgJiYgc2xlZXAgNSA7IG1vZHByb2JlIHVzYnNlcmlhbCcpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgIGV4ZWMoJ3NsZWVwIDU7IHd2ZGlhbCBEZWZhdWx0cyAtQyAnICsgY29uZmlnRmlsZVBhdGggKyAnIDE+JyArIHd2ZGlhbGVyciArICcgMj4nICsgd3ZkaWFsb3V0KS5jYXRjaChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxuY291bnQgPSBsbmNvdW50ICsgNjBcbiAgICAgICAgICAgICAgICAgICAgICAgIHd2Y29ubmVjdCgpXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhsbmNvdW50KVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9KS5jYXRjaChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgZXhlYygnc2xlZXAgNTsgd3ZkaWFsIERlZmF1bHRzIC1DICcgKyBjb25maWdGaWxlUGF0aCArICcgMT4nICsgd3ZkaWFsZXJyICsgJyAyPicgKyB3dmRpYWxvdXQpLmNhdGNoKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG5jb3VudCA9IGxuY291bnQgKyA2MFxuICAgICAgICAgICAgICAgICAgICAgICAgd3Zjb25uZWN0KClcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGxuY291bnQpXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfVxuXG4gICAgICAgIGZzLndyaXRlRmlsZVN5bmMod3ZkaWFsZXJyLCBcIlwiKTtcblxuICAgICAgICBmcy53cml0ZUZpbGVTeW5jKHd2ZGlhbG91dCwgXCJcIik7XG5cblxuXG4gICAgICAgIHZhciB0YWlsID0gbmV3IFRhaWwod3ZkaWFsb3V0LCAnXFxuJyk7XG5cbiAgICAgICAgdGFpbC5vbignbGluZScsIGZ1bmN0aW9uKGRhdGEpIHtcblxuICAgICAgICAgICAgbG5jb3VudCA9IGxuY291bnQgKyAxO1xuXG5cbiAgICAgICAgICAgIGlmIChkYXRhLnNwbGl0KFwiRE5TXCIpLmxlbmd0aCA9PSAyKSB7XG4gICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIC8vICAgZXhlYygnaXAgcm91dGUgYWRkIGRlZmF1bHQgZGV2IHBwcDAnKVxuICAgICAgICAgICAgICAgIC8vIH0sIDMwMDAwKTtcbiAgICAgICAgICAgICAgICBtb2JpbGVzdGF0dXMgPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyh3dmRpYWxlcnIsIFwiXCIpO1xuXG4gICAgICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyh3dmRpYWxvdXQsIFwiXCIpO1xuXG4gICAgICAgICAgICAgICAgbG5jb3VudCA9IDA7XG5cbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygncHBwIGNvbm5lY3RlZCcpXG5cbiAgICAgICAgICAgICAgICAvLyAgICBpZiAoIXdhdGNoKSB7XG4gICAgICAgICAgICAgICAgLy8gICAgICAgIHRhaWwudW53YXRjaCgpO1xuICAgICAgICAgICAgICAgIC8vICAgICAgIHJlc29sdmUodHJ1ZSk7XG5cbiAgICAgICAgICAgICAgICAvLyAgICB9XG5cblxuXG4gICAgICAgICAgICB9IGVsc2UgaWYgKGxuY291bnQgPiAyMDApIHtcbiAgICAgICAgICAgICAgICBtb2JpbGVzdGF0dXMgPSBmYWxzZTtcblxuICAgICAgICAgICAgICAgIGlmICghd2F0Y2gpIHtcbiAgICAgICAgICAgICAgICAgICAgdGFpbC51bndhdGNoKCk7XG4gICAgICAgICAgICAgICAgICAgIHJlamVjdCh0cnVlKTtcblxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGh3cmVzdGFydChcInVucGx1Z1wiKTtcbiAgICAgICAgICAgICAgICB9XG5cblxuXG5cblxuICAgICAgICAgICAgfVxuXG4gICAgICAgIH0pO1xuXG5cbiAgICAgICAgdGFpbC5vbignZXJyb3InLCBmdW5jdGlvbihkYXRhKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcInRhaWxlcnJvclwiKTtcblxuXG4gICAgICAgICAgICBpZiAoIXdhdGNoKSB7XG4gICAgICAgICAgICAgICAgdGFpbC51bndhdGNoKCk7XG4gICAgICAgICAgICAgICAgcmVqZWN0KHRydWUpO1xuXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGh3cmVzdGFydChcInVucGx1Z1wiKTtcbiAgICAgICAgICAgIH1cblxuXG5cblxuXG5cbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGFpbC53YXRjaCgpO1xuXG4gICAgICAgIHd2Y29ubmVjdCgpXG5cblxuXG5cblxuXG5cblxuXG4gICAgfSlcbn1cblxuXG5mdW5jdGlvbiBzZXRwcm92KGNvbmZpZ0ZpbGVQYXRoLCBwcm92aWRlcjogSVByb3ZpZGVyQ0YpIHtcblxuXG5cblxuICAgIGlmICghcHJvdmlkZXIucGhvbmUpIHByb3ZpZGVyLnBob25lID0gJyo5OSMnO1xuICAgIGlmICghcHJvdmlkZXIudXNlcm5hbWUpIHByb3ZpZGVyLnVzZXJuYW1lID0gJyc7XG4gICAgaWYgKCFwcm92aWRlci5wYXNzd29yZCkgcHJvdmlkZXIucGFzc3dvcmQgPSAnJztcblxuXG4gICAgdGhpcy5wcm92aWRlciA9IHByb3ZpZGVyO1xuXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPHsgc3VjY2Vzcz86IGJvb2xlYW4gfT4oZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgIGlmIChwcm92aWRlci5hcG4pIHtcbiAgICAgICAgICAgIHNldHN0cmluZyhjb25maWdGaWxlUGF0aCwgJ0luaXQzJywgJ0FUK0NHRENPTlQ9MSxcImlwXCIsXCInICsgcHJvdmlkZXIuYXBuICsgJ1wiLCwwLDAnKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdvayBhcG4nKTtcbiAgICAgICAgICAgICAgICBpZiAocHJvdmlkZXIucGhvbmUpIHtcbiAgICAgICAgICAgICAgICAgICAgc2V0c3RyaW5nKGNvbmZpZ0ZpbGVQYXRoLCAnUGhvbmUnLCBwcm92aWRlci5waG9uZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChwcm92aWRlci51c2VybmFtZSkge1xuICAgICAgICAgICAgICAgICAgICBzZXRzdHJpbmcoY29uZmlnRmlsZVBhdGgsICdVc2VybmFtZScsIHByb3ZpZGVyLnVzZXJuYW1lKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHByb3ZpZGVyLnBhc3N3b3JkKSB7XG4gICAgICAgICAgICAgICAgICAgIHNldHN0cmluZyhjb25maWdGaWxlUGF0aCwgJ1Bhc3N3b3JkJywgcHJvdmlkZXIucGFzc3dvcmQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXNvbHZlKHsgc3VjY2VzczogdHJ1ZSB9KTtcbiAgICAgICAgICAgIH0pXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZWplY3QoXCJubyBhcG5cIik7XG4gICAgICAgIH1cbiAgICB9KVxuXG59O1xuXG5pbnRlcmZhY2UgQ2xhc3NPcHQge1xuICAgIGNvbmZpZ0ZpbGVQYXRoPzogc3RyaW5nO1xuICAgIHByb3ZpZGVyPzogSVByb3ZpZGVyQ0Y7XG4gICAgZGV2aWNlPzogc3RyaW5nO1xufVxuXG5leHBvcnQgPWNsYXNzIFd2RGlhbCB7XG4gICAgY29uZmlnRmlsZVBhdGg6IHN0cmluZztcbiAgICBwcm92aWRlcjogSVByb3ZpZGVyQ0Y7XG4gICAgZGV2aWNlO1xuICAgIGNvbnN0cnVjdG9yKGNvbmY6IENsYXNzT3B0KSB7XG4gICAgICAgIGlmIChjb25mLmNvbmZpZ0ZpbGVQYXRoKSB7XG4gICAgICAgICAgICB0aGlzLmNvbmZpZ0ZpbGVQYXRoID0gY29uZi5jb25maWdGaWxlUGF0aDsgLy8gL2V0Yy93dmRpYWwuY29uZlxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5jb25maWdGaWxlUGF0aCA9ICcvZXRjL3d2ZGlhbC5jb25mJztcbiAgICAgICAgfVxuICAgICAgICBpZiAoY29uZi5wcm92aWRlcikge1xuICAgICAgICAgICAgaWYgKCFjb25mLnByb3ZpZGVyLnBob25lKSBjb25mLnByb3ZpZGVyLnBob25lID0gJyo5OSMnO1xuICAgICAgICAgICAgaWYgKCFjb25mLnByb3ZpZGVyLnVzZXJuYW1lKSBjb25mLnByb3ZpZGVyLnVzZXJuYW1lID0gJyc7XG4gICAgICAgICAgICBpZiAoIWNvbmYucHJvdmlkZXIucGFzc3dvcmQpIGNvbmYucHJvdmlkZXIucGFzc3dvcmQgPSAnJztcbiAgICAgICAgICAgIHRoaXMucHJvdmlkZXIgPSBjb25mLnByb3ZpZGVyOyAvLyAvZXRjL3d2ZGlhbC5jb25mXG4gICAgICAgIH1cblxuICAgICAgICBpZiAoY29uZi5kZXZpY2UpIHtcbiAgICAgICAgICAgIHRoaXMuZGV2aWNlID0gY29uZi5kZXZpY2U7IC8vIC9ldGMvd3ZkaWFsLmNvbmZcbiAgICAgICAgfVxuXG4gICAgfTtcblxuICAgIGNvbm5lY3Qod2F0Y2g/OiBib29sZWFuKSB7XG4gICAgICAgIGxldCBjb25maWdGaWxlUGF0aCA9IHRoaXMuY29uZmlnRmlsZVBhdGg7XG4gICAgICAgIGxldCBkZXYgPSB0aGlzLmRldmljZTtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlPGJvb2xlYW4+KGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ2Nvbm5lY3Rpb24nKTtcblxuICAgICAgICAgICAgZ2V0c3RyaW5nKGNvbmZpZ0ZpbGVQYXRoLCAnTW9kZW0nKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIGNvbm5lY3QoY29uZmlnRmlsZVBhdGgsIHdhdGNoLCBkZXYpLnRoZW4oZnVuY3Rpb24oYW5zd2VyKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghd2F0Y2gpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShhbnN3ZXIpO1xuXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBod3Jlc3RhcnQoXCJ1bnBsdWdcIik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KS5jYXRjaChmdW5jdGlvbihlcnIpIHtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoIXdhdGNoKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdCgncnJycnJyJyk7XG5cbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGh3cmVzdGFydChcInVucGx1Z1wiKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG5cbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgaWYgKCF3YXRjaCkge1xuXG4gICAgICAgICAgICAgICAgICAgIHJlamVjdCgnZXJycnInKTtcblxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGh3cmVzdGFydChcInVucGx1Z1wiKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KVxuICAgIH07XG5cbiAgICBzZXRVc2IoZGV2aWNlOiBzdHJpbmcpIHtcbiAgICAgICAgbGV0IGNvbmZpZ0ZpbGVQYXRoID0gdGhpcy5jb25maWdGaWxlUGF0aDtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlPHsgc3VjY2Vzcz86IGJvb2xlYW4gfT4oZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG5cbiAgICAgICAgICAgIGlmIChkZXZpY2UpIHtcbiAgICAgICAgICAgICAgICBzZXRzdHJpbmcoY29uZmlnRmlsZVBhdGgsICdNb2RlbScsIGRldmljZS5yZXBsYWNlKC9cXC8vZywgJ1xcXFxcXC8nKSkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh7IHN1Y2Nlc3M6IHRydWUgfSk7XG4gICAgICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuXG4gICAgICAgICAgICAgICAgfSk7XG5cblxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZWplY3QoeyBlcnJvcjogXCJObyBkZXZpY2UgXCIgKyBkZXZpY2UgKyBcIiBmb3VuZGVkXCIgfSk7XG5cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICB9O1xuXG4gICAgc2V0UHJvdmlkZXIocHJvdmlkZXI6IElQcm92aWRlckNGKSB7XG4gICAgICAgIHRoaXMucHJvdmlkZXIgPSBwcm92aWRlcjtcbiAgICAgICAgcmV0dXJuIHNldHByb3YodGhpcy5jb25maWdGaWxlUGF0aCwgcHJvdmlkZXIpXG5cbiAgICB9O1xuXG4gICAgZ2V0Q29uZmlnKCkge1xuICAgICAgICByZXR1cm4gYWxsc3RyaW5ncyh0aGlzLmNvbmZpZ0ZpbGVQYXRoKTtcbiAgICB9O1xuXG4gICAgc2V0UGFyYW0oa2V5OiBzdHJpbmcsIHZhbDogc3RyaW5nKSB7XG4gICAgICAgIHJldHVybiBzZXRzdHJpbmcodGhpcy5jb25maWdGaWxlUGF0aCwga2V5LCB2YWwpO1xuICAgIH07XG5cbiAgICBnZXRQYXJhbShwYXJhbTogc3RyaW5nKSB7XG4gICAgICAgIHJldHVybiBnZXRzdHJpbmcodGhpcy5jb25maWdGaWxlUGF0aCwgcGFyYW0pO1xuICAgIH07XG5cbiAgICBzdGF0dXMoKSB7XG5cbiAgICAgICAgcmV0dXJuIG1vYmlsZXN0YXR1c1xuXG4gICAgfVxuICAgIHNldGRldihkZXZpY2U/OiBzdHJpbmcpIHtcblxuICAgICAgICBpZiAoZGV2aWNlKSB7XG4gICAgICAgICAgICB0aGlzLmRldmljZSA9IGRldmljZTtcbiAgICAgICAgfVxuICAgICAgICBsZXQgc2V0ZGV2ID0gdGhpcy5kZXZpY2U7XG4gICAgICAgIGxldCBjb25maWdGaWxlUGF0aCA9IHRoaXMuY29uZmlnRmlsZVBhdGg7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZTxib29sZWFuPihmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgICAgIGxzdXNiZGV2KCkudGhlbihmdW5jdGlvbihkYXRhKSB7XG4gICAgICAgICAgICAgICAgbGV0IGRldnRvOiBhbnkgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHVzYiA9IGRhdGFbaV07XG5cblxuICAgICAgICAgICAgICAgICAgICBpZiAodXNiLnR5cGUgPT0gJ3NlcmlhbCcgJiYgdXNiLmh1YiA9PSBkZXZpY2UgJiYgIWRldnRvKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnc2V0ICcgKyB1c2IuZGV2KVxuXG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGRldnRvID0gdXNiLmRldjtcblxuXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cblxuICAgICAgICAgICAgICAgIGlmIChkZXZ0bykge1xuICAgICAgICAgICAgICAgICAgICBzZXRzdHJpbmcoY29uZmlnRmlsZVBhdGgsICdNb2RlbScsIGRldnRvKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2V0ZGV2ID0gZGV2aWNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoeyBlcnJvcjogJ2Vycm9yIG9uIHNldHN0cmluZyAnIH0pO1xuICAgICAgICAgICAgICAgICAgICB9KVxuXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgICAgICAgICByZWplY3QoeyBlcnJvcjogJ2Vycm9yIG9uIG1vZGVtICcgfSk7XG5cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIH0pXG5cbiAgICAgICAgfSlcblxuICAgIH1cbiAgICBjb25maWd1cmUocmVzZXQ/OiBib29sZWFuKSB7XG4gICAgICAgIGxldCBwcm92aWRlciA9IHRoaXMucHJvdmlkZXI7XG5cbiAgICAgICAgbGV0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuXG5cbiAgICAgICAgbGV0IGNvbmZpZ0ZpbGVQYXRoID0gdGhpcy5jb25maWdGaWxlUGF0aDtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlPHsgc3VjY2Vzcz86IGJvb2xlYW4gfT4oZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgICAgICBpZiAocHJvdmlkZXIpIHtcblxuICAgICAgICAgICAgICAgIGlmICghcmVzZXQgJiYgZGV2aWNlKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgc2V0cHJvdihjb25maWdGaWxlUGF0aCwgcHJvdmlkZXIpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsc3VzYmRldigpLnRoZW4oZnVuY3Rpb24oZGF0YSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCBkZXZ0bzogYW55ID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBkYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciB1c2IgPSBkYXRhW2ldO1xuXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHVzYi50eXBlID09ICdzZXJpYWwnICYmIHVzYi5odWIgPT0gZGV2aWNlICYmICFkZXZ0bykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ3NldCAnICsgdXNiLmRldilcblxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXZ0byA9IHVzYi5kZXY7XG5cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZGV2dG8pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2V0c3RyaW5nKGNvbmZpZ0ZpbGVQYXRoLCAnTW9kZW0nLCBkZXZ0bykudGhlbihmdW5jdGlvbigpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh7IHN1Y2Nlc3M6IHRydWUgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KHsgZXJyb3I6ICdlcnJvciBvbiBzZXRzdHJpbmcgJyB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KHsgZXJyb3I6ICdlcnJvciBvbiBtb2RlbSAnIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuXG4gICAgICAgICAgICAgICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KHsgZXJyb3I6ICdlcnJvciBvbiBzZXRwcm92ICcgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0pXG5cbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHJlc2V0KSB7XG5cbiAgICAgICAgICAgICAgICAgICAgZXhlYygnZWNobyBcIltEaWFsZXIgRGVmYXVsdHNdXCIgPiAnICsgY29uZmlnRmlsZVBhdGgpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBleGVjKCdlY2hvIFxcJ0luaXQzID0gQVQrQ0dEQ09OVD0xLFwiaXBcIixcIicgKyBwcm92aWRlci5hcG4gKyAnXCIsLDAsMFxcJyA+PiAnICsgY29uZmlnRmlsZVBhdGgpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZXhlYygnZWNobyBcIlBob25lID0gJyArIHByb3ZpZGVyLnBob25lICsgJ1wiID4+ICcgKyBjb25maWdGaWxlUGF0aCkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXhlYygnZWNobyBcIlVzZXJuYW1lID0gJyArIHByb3ZpZGVyLnVzZXJuYW1lICsgJ1wiID4+ICcgKyBjb25maWdGaWxlUGF0aCkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV4ZWMoJ2VjaG8gXCJQYXNzd29yZCA9ICcgKyBwcm92aWRlci5wYXNzd29yZCArICdcIiA+PiAnICsgY29uZmlnRmlsZVBhdGgpLnRoZW4oZnVuY3Rpb24oKSB7XG5cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV4ZWMoJ3d2ZGlhbGNvbmYgJyArIGNvbmZpZ0ZpbGVQYXRoKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHsgc3VjY2VzczogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KS5jYXRjaChmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KHsgZXJyb3I6ICdlcnJvciBvbiBtb2RlbSAnIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pXG5cblxuXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXG5cbiAgICAgICAgICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoeyBlcnJvcjogJ2Vycm9yIG9uIG9wZW4gJyArIGNvbmZpZ0ZpbGVQYXRoIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuXG5cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZWplY3QoeyBlcnJvcjogJ21pc3MgY29uZmlndXJhdGlvbicgfSk7XG4gICAgICAgICAgICAgICAgfVxuXG5cblxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZWplY3QoeyBlcnJvcjogJ211c3QgcHVzaCBhIHByb3ZpZGVyJyB9KTtcblxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuICAgIH07XG5cblxufTtcbiJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==
