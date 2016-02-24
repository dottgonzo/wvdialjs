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
                    setprov(configFilePath, setprovider).then(function () {
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

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImluZGV4LnRzIl0sIm5hbWVzIjpbInNldHN0cmluZyIsImdldHN0cmluZyIsImFsbHN0cmluZ3MiLCJjb25uZWN0Iiwid3Zjb25uZWN0Iiwic2V0cHJvdiIsImNvbnN0cnVjdG9yIiwic2V0VXNiIiwic2V0UHJvdmlkZXIiLCJnZXRDb25maWciLCJzZXRQYXJhbSIsImdldFBhcmFtIiwic3RhdHVzIiwic2V0ZGV2IiwiY29uZmlndXJlIl0sIm1hcHBpbmdzIjoiQUFBQSxJQUFZLE9BQU8sV0FBTSxVQUFVLENBQUMsQ0FBQTtBQUVwQyxJQUFZLEVBQUUsV0FBTSxJQUFJLENBQUMsQ0FBQTtBQUN6QixJQUFPLFFBQVEsV0FBVyxVQUFVLENBQUMsQ0FBQztBQUN0QyxJQUFJLFNBQVMsR0FBRyxPQUFPLENBQUMsV0FBVyxDQUFDLENBQUM7QUFFckMsSUFBSSxJQUFJLEdBQUcsT0FBTyxDQUFDLGVBQWUsQ0FBQyxDQUFDO0FBQ3BDLElBQUksSUFBSSxHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQztBQUVsQyxJQUFJLElBQUksR0FBRyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUM7QUFFNUIsSUFBSSxZQUFZLEdBQUcsS0FBSyxDQUFDO0FBU3hCLENBQUM7QUF5QkYsbUJBQW1CLGNBQXNCLEVBQUUsR0FBRyxFQUFFLEdBQUc7SUFFL0NBLE1BQU1BLENBQUNBLElBQUlBLE9BQU9BLENBQXdCQSxVQUFTQSxPQUFPQSxFQUFFQSxNQUFNQTtRQUM5RCxTQUFTLENBQUMsY0FBYyxFQUFFLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFTLFNBQWlCO1lBQzFELElBQUksQ0FBQyxlQUFlLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsRUFBRSxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsS0FBSyxHQUFHLFNBQVMsQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUs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QUFHO3dCQUNqQixNQUFNLENBQUMsRUFBRSxLQUFLLEVBQUUsZ0JBQWdCLEdBQUcsY0FBYyxFQUFFLENBQUMsQ0FBQztvQkFFekQsQ0FBQyxDQUFDLENBQUM7Z0JBR1AsQ0FBQztZQUlMLENBQUM7WUFBQyxJQUFJLENBQUMsQ0FBQztnQkFDSixNQUFNLENBQUMsRUFBRSxLQUFLLEVBQUUsc0JBQXNCLEVBQUUsQ0FBQyxDQUFDO1lBRTlDLENBQUM7UUFDTCxDQUFDLENBQUNBLENBQUFBO0lBQ05BLENBQUNBOztJQUdMLGFBQUM7QUFBRCxDQXRPUSxBQXNPUCxHQUFBLENBQUMiLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBQcm9taXNlIGZyb20gXCJibHVlYmlyZFwiO1xuaW1wb3J0ICogYXMgcGF0aEV4aXN0cyBmcm9tIFwicGF0aC1leGlzdHNcIjtcbmltcG9ydCAqIGFzIGZzIGZyb20gXCJmc1wiO1xuaW1wb3J0IGxzdXNiZGV2ID0gcmVxdWlyZShcImxzdXNiZGV2XCIpO1xubGV0IGh3cmVzdGFydCA9IHJlcXVpcmUoJ2h3cmVzdGFydCcpO1xuXG5sZXQgZXhlYyA9IHJlcXVpcmUoJ3Byb21pc2VkLWV4ZWMnKTtcbmxldCBUYWlsID0gcmVxdWlyZSgnYWx3YXlzLXRhaWwnKTtcblxubGV0IHZlcmIgPSByZXF1aXJlKCd2ZXJibycpO1xuXG5sZXQgbW9iaWxlc3RhdHVzID0gZmFsc2U7XG5cbi8vc3Bhd24gPSByZXF1aXJlKCdjaGlsZF9wcm9jZXNzJykuc3Bhd24sXG5cblxuaW50ZXJmYWNlIElDb25mT3B0IHtcbiAgICB2ZXJib3NlPzogYm9vbGVhbjtcbiAgICBkZXY/OiBhbnk7XG4gICAgcHJvdmlkZXI6IElQcm92aWRlckNGO1xufTtcblxuXG5pbnRlcmZhY2UgSVByb3ZpZGVyQ0Yge1xuXG4gICAgbGFiZWw/OiBzdHJpbmc7XG4gICAgYXBuOiBzdHJpbmc7XG4gICAgcGhvbmU/OiBzdHJpbmc7XG4gICAgdXNlcm5hbWU/OiBzdHJpbmc7XG4gICAgcGFzc3dvcmQ/OiBzdHJpbmc7XG5cbn1cbmludGVyZmFjZSBJUHJvdmlkZXIge1xuXG4gICAgbGFiZWw/OiBzdHJpbmc7XG4gICAgYXBuOiBzdHJpbmc7XG4gICAgcGhvbmU6IHN0cmluZztcbiAgICB1c2VybmFtZTogc3RyaW5nO1xuICAgIHBhc3N3b3JkOiBzdHJpbmc7XG5cbn1cbi8vIG1vZHByb2JlIHVzYnNlcmlhbFxuLy8gd3ZkaWFsY29uZlxuLy8gd3ZkaWFsIERlZmF1bHRzIDE+L2Rldi9udWxsIDI+L2Rldi9udWxsXG5cbmZ1bmN0aW9uIHNldHN0cmluZyhjb25maWdGaWxlUGF0aDogc3RyaW5nLCBrZXksIHZhbCkge1xuXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPHsgc3VjY2Vzcz86IGJvb2xlYW4gfT4oZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgIGdldHN0cmluZyhjb25maWdGaWxlUGF0aCwga2V5KS50aGVuKGZ1bmN0aW9uKG9sZHN0cmluZzogc3RyaW5nKSB7XG4gICAgICAgICAgICBleGVjKCdzZWQgLWkgLWUgXCJzLycgKyBrZXlbMF0udG9VcHBlckNhc2UoKSArIGtleS5zbGljZSgxKSArICcgPSAnICsgb2xkc3RyaW5nLnJlcGxhY2UoL1xcJy9nLCAnXFxcXFwiJykucmVwbGFjZSgvXFwvL2csICdcXFxcXFwvJykgKyAnLycgKyBrZXlbMF0udG9VcHBlckNhc2UoKSArIGtleS5zbGljZSgxKSArICcgPSAnICsgdmFsLnJlcGxhY2UoL1xcXCIvZywgJ1xcXFxcIicpLnJlcGxhY2UoL1xcLy9nLCAnXFxcXFxcLycpICsgJy9nXCIgJyArIGNvbmZpZ0ZpbGVQYXRoICsgJycpLnRoZW4oZnVuY3Rpb24oc3Rkb3V0KSB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZSh7IHN1Y2Nlc3M6IHRydWUgfSk7XG4gICAgICAgICAgICB9KS5jYXRjaChmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgICAgICByZWplY3QoeyBlcnJvcjogZXJyIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgcmVqZWN0KHsgZXJyb3I6IGVyciB9KTtcbiAgICAgICAgfSk7XG4gICAgfSk7XG59XG5mdW5jdGlvbiBnZXRzdHJpbmcoY29uZmlnRmlsZVBhdGg6IHN0cmluZywgcGFyYW0pIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgIGFsbHN0cmluZ3MoY29uZmlnRmlsZVBhdGgpLnRoZW4oZnVuY3Rpb24oZGF0YSkge1xuICAgICAgICAgICAgbGV0IHRlc3QgPSBmYWxzZTtcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgT2JqZWN0LmtleXMoZGF0YSkubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAoT2JqZWN0LmtleXMoZGF0YSlbaV0gPT0gKHBhcmFtWzBdLnRvVXBwZXJDYXNlKCkgKyBwYXJhbS5zbGljZSgxKSkpIHtcbiAgICAgICAgICAgICAgICAgICAgdGVzdCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoZGF0YVtPYmplY3Qua2V5cyhkYXRhKVtpXV0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghdGVzdCkge1xuICAgICAgICAgICAgICAgIHJlamVjdCh7IGVycm9yOiBcIndyb25nIHBhcmFtXCIgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgcmVqZWN0KHsgZXJyb3I6IGVyciB9KTtcbiAgICAgICAgfSlcbiAgICB9KVxufVxuZnVuY3Rpb24gYWxsc3RyaW5ncyhjb25maWdGaWxlUGF0aDogc3RyaW5nKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuXG4gICAgICAgIGV4ZWMoX19kaXJuYW1lICsgJy93dmRpYWwuc2ggIC10IFwiZ2V0XCIgLWNcIicgKyBjb25maWdGaWxlUGF0aCArICdcIicpLnRoZW4oZnVuY3Rpb24oZGF0YSkge1xuICAgICAgICAgICAgcmVzb2x2ZShKU09OLnBhcnNlKGRhdGEpKTtcbiAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgfSlcbiAgICB9KVxufVxuXG5mdW5jdGlvbiBjb25uZWN0KGNvbmZpZ0ZpbGVQYXRoOiBzdHJpbmcsIHdhdGNoPzogYm9vbGVhbiwgZGV2aWNlPzogc3RyaW5nKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPGJvb2xlYW4+KGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuXG5cbiAgICAgICAgY29uc29sZS5sb2coZGV2aWNlKVxuXG4gICAgICAgIGxldCBleGlzdCA9IGZhbHNlO1xuICAgICAgICBsc3VzYmRldigpLnRoZW4oZnVuY3Rpb24oZGF0YTogW3sgdHlwZTogc3RyaW5nLCBkZXY6IHN0cmluZywgcHJvZHVjdDogc3RyaW5nLCBodWI6IHN0cmluZywgaWQ6IHN0cmluZyB9XSkge1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBkYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdmFyIHVzYiA9IGRhdGFbaV07XG4gICAgICAgICAgICAgICAgaWYgKHVzYi50eXBlID09ICdzZXJpYWwnICYmIChkZXZpY2UgJiYgdXNiLmh1YiA9PSBkZXZpY2UpIHx8ICFkZXZpY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgZXhpc3QgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcInBhc3MxXCIpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgIH0pXG5cbiAgICAgICAgaWYgKCFleGlzdCkgaHdyZXN0YXJ0KFwicmVib290XCIpXG4gICAgICAgIFxuICAgICAgICAvLyBjaGVjayBpZiB3dmRpYWwuY29uZiB1c2IgaXMgcHJlc2VudFxuICAgICAgICBjb25zb2xlLmxvZyhjb25maWdGaWxlUGF0aClcblxuXG4gICAgICAgIGxldCB3dmRpYWxlcnIgPSBcIi90bXAvV3ZkaWFsLmVyclwiXG4gICAgICAgIGxldCB3dmRpYWxvdXQgPSBcIi90bXAvV3ZkaWFsLm91dFwiXG5cbiAgICAgICAgbGV0IGxuY291bnQgPSAwO1xuXG4gICAgICAgIGZ1bmN0aW9uIHd2Y29ubmVjdCgpIHtcbiAgICAgICAgICAgIG1vYmlsZXN0YXR1cyA9IGZhbHNlO1xuICAgICAgICAgICAgaWYgKGxuY291bnQgPiAyMDApIHtcblxuXG5cbiAgICAgICAgICAgICAgICBpZiAoIXdhdGNoKSB7XG4gICAgICAgICAgICAgICAgICAgIHRhaWwudW53YXRjaCgpO1xuICAgICAgICAgICAgICAgICAgICByZWplY3QodHJ1ZSk7XG5cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcInJlYm9vdFwiKVxuICAgICAgICAgICAgICAgICAgICBod3Jlc3RhcnQoXCJ1bnBsdWdcIik7XG4gICAgICAgICAgICAgICAgfVxuXG5cblxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGRldmljZSkge1xuXG5cbiAgICAgICAgICAgICAgICBsc3VzYmRldigpLnRoZW4oZnVuY3Rpb24oZGF0YSkge1xuICAgICAgICAgICAgICAgICAgICBsZXQgZGV2dG86IGFueSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciB1c2IgPSBkYXRhW2ldO1xuXG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh1c2IudHlwZSA9PSAnc2VyaWFsJyAmJiB1c2IuaHViID09IGRldmljZSAmJiAhZGV2dG8pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnc2V0ICcgKyB1c2IuZGV2KVxuXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXZ0byA9IHVzYi5kZXY7XG5cblxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG5cblxuICAgICAgICAgICAgICAgICAgICBpZiAoZGV2dG8pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNldHN0cmluZyhjb25maWdGaWxlUGF0aCwgJ01vZGVtJywgZGV2dG8pLnRoZW4oZnVuY3Rpb24oKSB7XG5cblxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZXhlYygncGtpbGwgd3ZkaWFsICYmIHNsZWVwIDUgOyBtb2Rwcm9iZSB1c2JzZXJpYWwnKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBleGVjKCdzbGVlcCA1OyB3dmRpYWwgRGVmYXVsdHMgLUMgJyArIGNvbmZpZ0ZpbGVQYXRoICsgJyAxPicgKyB3dmRpYWxlcnIgKyAnIDI+JyArIHd2ZGlhbG91dCkuY2F0Y2goZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsbmNvdW50ID0gbG5jb3VudCArIDYwXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB3dmNvbm5lY3QoKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2cobG5jb3VudClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV4ZWMoJ3NsZWVwIDU7IHd2ZGlhbCBEZWZhdWx0cyAtQyAnICsgY29uZmlnRmlsZVBhdGggKyAnIDE+JyArIHd2ZGlhbGVyciArICcgMj4nICsgd3ZkaWFsb3V0KS5jYXRjaChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxuY291bnQgPSBsbmNvdW50ICsgNjBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHd2Y29ubmVjdCgpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhsbmNvdW50KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhlcnIgKyBcIiBzZXQgc3RyaW5nIGVycm9yXCIpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG5jb3VudCA9IGxuY291bnQgKyAzMFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHd2Y29ubmVjdCgpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2cobG5jb3VudClcblxuXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCIgZXJyMlwiKVxuICAgICAgICAgICAgICAgICAgICAgICAgbG5jb3VudCA9IGxuY291bnQgKyAzMFxuICAgICAgICAgICAgICAgICAgICAgICAgd3Zjb25uZWN0KClcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGxuY291bnQpXG5cblxuXG4gICAgICAgICAgICAgICAgICAgIH1cblxuXG4gICAgICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGxuY291bnQgPSBsbmNvdW50ICsgNjBcbiAgICAgICAgICAgICAgICAgICAgd3Zjb25uZWN0KClcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2cobG5jb3VudClcblxuICAgICAgICAgICAgICAgIH0pO1xuXG5cbiAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICBleGVjKCdwa2lsbCB3dmRpYWwgJiYgc2xlZXAgNSA7IG1vZHByb2JlIHVzYnNlcmlhbCcpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgIGV4ZWMoJ3NsZWVwIDU7IHd2ZGlhbCBEZWZhdWx0cyAtQyAnICsgY29uZmlnRmlsZVBhdGggKyAnIDE+JyArIHd2ZGlhbGVyciArICcgMj4nICsgd3ZkaWFsb3V0KS5jYXRjaChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxuY291bnQgPSBsbmNvdW50ICsgNjBcbiAgICAgICAgICAgICAgICAgICAgICAgIHd2Y29ubmVjdCgpXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhsbmNvdW50KVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9KS5jYXRjaChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgZXhlYygnc2xlZXAgNTsgd3ZkaWFsIERlZmF1bHRzIC1DICcgKyBjb25maWdGaWxlUGF0aCArICcgMT4nICsgd3ZkaWFsZXJyICsgJyAyPicgKyB3dmRpYWxvdXQpLmNhdGNoKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG5jb3VudCA9IGxuY291bnQgKyA2MFxuICAgICAgICAgICAgICAgICAgICAgICAgd3Zjb25uZWN0KClcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGxuY291bnQpXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfVxuXG4gICAgICAgIGZzLndyaXRlRmlsZVN5bmMod3ZkaWFsZXJyLCBcIlwiKTtcblxuICAgICAgICBmcy53cml0ZUZpbGVTeW5jKHd2ZGlhbG91dCwgXCJcIik7XG5cblxuXG4gICAgICAgIHZhciB0YWlsID0gbmV3IFRhaWwod3ZkaWFsb3V0LCAnXFxuJyk7XG5cbiAgICAgICAgdGFpbC5vbignbGluZScsIGZ1bmN0aW9uKGRhdGEpIHtcblxuICAgICAgICAgICAgbG5jb3VudCA9IGxuY291bnQgKyAxO1xuXG5cbiAgICAgICAgICAgIGlmIChkYXRhLnNwbGl0KFwiRE5TXCIpLmxlbmd0aCA9PSAyKSB7XG4gICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIC8vICAgZXhlYygnaXAgcm91dGUgYWRkIGRlZmF1bHQgZGV2IHBwcDAnKVxuICAgICAgICAgICAgICAgIC8vIH0sIDMwMDAwKTtcbiAgICAgICAgICAgICAgICBtb2JpbGVzdGF0dXMgPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyh3dmRpYWxlcnIsIFwiXCIpO1xuXG4gICAgICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyh3dmRpYWxvdXQsIFwiXCIpO1xuXG4gICAgICAgICAgICAgICAgbG5jb3VudCA9IDA7XG5cbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygncHBwIGNvbm5lY3RlZCcpXG5cbiAgICAgICAgICAgIC8vICAgIGlmICghd2F0Y2gpIHtcbiAgICAgICAgICAgIC8vICAgICAgICB0YWlsLnVud2F0Y2goKTtcbiAgICAgICAgICAgICAvLyAgICAgICByZXNvbHZlKHRydWUpO1xuXG4gICAgICAgICAgICAvLyAgICB9XG5cblxuXG4gICAgICAgICAgICB9IGVsc2UgaWYgKGxuY291bnQgPiAyMDApIHtcbiAgICAgICAgICAgICAgICBtb2JpbGVzdGF0dXMgPSBmYWxzZTtcblxuICAgICAgICAgICAgICAgIGlmICghd2F0Y2gpIHtcbiAgICAgICAgICAgICAgICAgICAgdGFpbC51bndhdGNoKCk7XG4gICAgICAgICAgICAgICAgICAgIHJlamVjdCh0cnVlKTtcblxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGh3cmVzdGFydChcInVucGx1Z1wiKTtcbiAgICAgICAgICAgICAgICB9XG5cblxuXG5cblxuICAgICAgICAgICAgfVxuXG4gICAgICAgIH0pO1xuXG5cbiAgICAgICAgdGFpbC5vbignZXJyb3InLCBmdW5jdGlvbihkYXRhKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcInRhaWxlcnJvclwiKTtcblxuXG4gICAgICAgICAgICBpZiAoIXdhdGNoKSB7XG4gICAgICAgICAgICAgICAgdGFpbC51bndhdGNoKCk7XG4gICAgICAgICAgICAgICAgcmVqZWN0KHRydWUpO1xuXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGh3cmVzdGFydChcInVucGx1Z1wiKTtcbiAgICAgICAgICAgIH1cblxuXG5cblxuXG5cbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGFpbC53YXRjaCgpO1xuXG4gICAgICAgIHd2Y29ubmVjdCgpXG5cblxuXG5cblxuXG5cblxuXG4gICAgfSlcbn1cblxuXG5mdW5jdGlvbiBzZXRwcm92KGNvbmZpZ0ZpbGVQYXRoLCBwcm92aWRlcjogSVByb3ZpZGVyQ0YpIHtcblxuXG5cblxuICAgIGlmICghcHJvdmlkZXIucGhvbmUpIHByb3ZpZGVyLnBob25lID0gJyo5OSMnO1xuICAgIGlmICghcHJvdmlkZXIudXNlcm5hbWUpIHByb3ZpZGVyLnVzZXJuYW1lID0gJyc7XG4gICAgaWYgKCFwcm92aWRlci5wYXNzd29yZCkgcHJvdmlkZXIucGFzc3dvcmQgPSAnJztcblxuXG4gICAgdGhpcy5wcm92aWRlciA9IHByb3ZpZGVyO1xuXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPHsgc3VjY2Vzcz86IGJvb2xlYW4gfT4oZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgIGlmIChwcm92aWRlci5hcG4pIHtcbiAgICAgICAgICAgIHNldHN0cmluZyhjb25maWdGaWxlUGF0aCwgJ0luaXQzJywgJ0FUK0NHRENPTlQ9MSxcImlwXCIsXCInICsgcHJvdmlkZXIuYXBuICsgJ1wiLCwwLDAnKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdvayBhcG4nKTtcbiAgICAgICAgICAgICAgICBpZiAocHJvdmlkZXIucGhvbmUpIHtcbiAgICAgICAgICAgICAgICAgICAgc2V0c3RyaW5nKGNvbmZpZ0ZpbGVQYXRoLCAnUGhvbmUnLCBwcm92aWRlci5waG9uZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChwcm92aWRlci51c2VybmFtZSkge1xuICAgICAgICAgICAgICAgICAgICBzZXRzdHJpbmcoY29uZmlnRmlsZVBhdGgsICdVc2VybmFtZScsIHByb3ZpZGVyLnVzZXJuYW1lKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHByb3ZpZGVyLnBhc3N3b3JkKSB7XG4gICAgICAgICAgICAgICAgICAgIHNldHN0cmluZyhjb25maWdGaWxlUGF0aCwgJ1Bhc3N3b3JkJywgcHJvdmlkZXIucGFzc3dvcmQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXNvbHZlKHsgc3VjY2VzczogdHJ1ZSB9KTtcbiAgICAgICAgICAgIH0pXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZWplY3QoXCJubyBhcG5cIik7XG4gICAgICAgIH1cbiAgICB9KVxuXG59O1xuXG5cbmV4cG9ydCA9Y2xhc3MgV3ZEaWFsIHtcbiAgICBjb25maWdGaWxlUGF0aDogc3RyaW5nO1xuICAgIHByb3ZpZGVyOiBJUHJvdmlkZXJDRjtcbiAgICBkZXZpY2U6IGFueTtcbiAgICBjb25zdHJ1Y3RvcihwYXRoOiBzdHJpbmcsIGRldmljZT86IHN0cmluZykge1xuICAgICAgICBpZiAocGF0aCkge1xuICAgICAgICAgICAgdGhpcy5jb25maWdGaWxlUGF0aCA9IHBhdGg7IC8vIC9ldGMvd3ZkaWFsLmNvbmZcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuY29uZmlnRmlsZVBhdGggPSAnL2V0Yy93dmRpYWwuY29uZic7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGRldmljZSkge1xuICAgICAgICAgICAgdGhpcy5kZXZpY2UgPSBkZXZpY2U7IC8vIC9ldGMvd3ZkaWFsLmNvbmZcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuZGV2aWNlID0gZmFsc2U7IC8vIC9ldGMvd3ZkaWFsLmNvbmZcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBjb25uZWN0KHdhdGNoPzogYm9vbGVhbikge1xuICAgICAgICBsZXQgY29uZmlnRmlsZVBhdGggPSB0aGlzLmNvbmZpZ0ZpbGVQYXRoO1xuICAgICAgICBsZXQgZGV2ID0gdGhpcy5kZXZpY2U7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZTxib29sZWFuPihmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdjb25uZWN0aW9uJyk7XG5cbiAgICAgICAgICAgIGdldHN0cmluZyhjb25maWdGaWxlUGF0aCwgJ01vZGVtJykudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBjb25uZWN0KGNvbmZpZ0ZpbGVQYXRoLCB3YXRjaCwgZGV2KS50aGVuKGZ1bmN0aW9uKGFuc3dlcikge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKGFuc3dlcik7XG4gICAgICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24oZXJyKSB7XG5cbiAgICAgICAgICAgIGlmICghd2F0Y2gpIHtcblxuICAgICAgICAgICAgICAgIHJlamVjdCgncnJycnJyJyk7XG5cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaHdyZXN0YXJ0KFwidW5wbHVnXCIpO1xuICAgICAgICAgICAgfVxuXG5cbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24oKSB7XG4gICAgICAgICAgaWYgKCF3YXRjaCkge1xuXG4gICAgICAgICAgICAgICAgcmVqZWN0KCdlcnJycicpO1xuXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGh3cmVzdGFydChcInVucGx1Z1wiKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pXG4gICAgfTtcblxuICAgIHNldFVzYihkZXZpY2U6IHN0cmluZykge1xuICAgICAgICBsZXQgY29uZmlnRmlsZVBhdGggPSB0aGlzLmNvbmZpZ0ZpbGVQYXRoO1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2U8eyBzdWNjZXNzPzogYm9vbGVhbiB9PihmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcblxuICAgICAgICAgICAgaWYgKGRldmljZSkge1xuICAgICAgICAgICAgICAgIHNldHN0cmluZyhjb25maWdGaWxlUGF0aCwgJ01vZGVtJywgZGV2aWNlLnJlcGxhY2UoL1xcLy9nLCAnXFxcXFxcLycpKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHsgc3VjY2VzczogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICB9KS5jYXRjaChmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG5cbiAgICAgICAgICAgICAgICB9KTtcblxuXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJlamVjdCh7IGVycm9yOiBcIk5vIGRldmljZSBcIiArIGRldmljZSArIFwiIGZvdW5kZWRcIiB9KTtcblxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuICAgIH07XG5cbiAgICBzZXRQcm92aWRlcihwcm92aWRlcjogSVByb3ZpZGVyQ0YpIHtcbiAgICAgICAgcmV0dXJuIHNldHByb3YodGhpcy5jb25maWdGaWxlUGF0aCwgcHJvdmlkZXIpXG5cbiAgICB9O1xuXG4gICAgZ2V0Q29uZmlnKCkge1xuICAgICAgICByZXR1cm4gYWxsc3RyaW5ncyh0aGlzLmNvbmZpZ0ZpbGVQYXRoKTtcbiAgICB9O1xuXG4gICAgc2V0UGFyYW0oa2V5OiBzdHJpbmcsIHZhbDogc3RyaW5nKSB7XG4gICAgICAgIHJldHVybiBzZXRzdHJpbmcodGhpcy5jb25maWdGaWxlUGF0aCwga2V5LCB2YWwpO1xuICAgIH07XG5cbiAgICBnZXRQYXJhbShwYXJhbTogc3RyaW5nKSB7XG4gICAgICAgIHJldHVybiBnZXRzdHJpbmcodGhpcy5jb25maWdGaWxlUGF0aCwgcGFyYW0pO1xuICAgIH07XG5cbiAgICBzdGF0dXMoKSB7XG5cbiAgICAgICAgcmV0dXJuIG1vYmlsZXN0YXR1c1xuXG4gICAgfVxuICAgIHNldGRldihkZXZpY2U6IHN0cmluZykge1xuICAgICAgICBsZXQgc2V0ZGV2ID0gdGhpcy5kZXZpY2U7XG4gICAgICAgIGxldCBjb25maWdGaWxlUGF0aCA9IHRoaXMuY29uZmlnRmlsZVBhdGg7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZTx7IHN1Y2Nlc3M/OiBib29sZWFuIH0+KGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAgICAgbHN1c2JkZXYoKS50aGVuKGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgICAgICAgICBsZXQgZGV2dG86IGFueSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICB2YXIgdXNiID0gZGF0YVtpXTtcblxuXG4gICAgICAgICAgICAgICAgICAgIGlmICh1c2IudHlwZSA9PSAnc2VyaWFsJyAmJiB1c2IuaHViID09IGRldmljZSAmJiAhZGV2dG8pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdzZXQgJyArIHVzYi5kZXYpXG5cblxuICAgICAgICAgICAgICAgICAgICAgICAgZGV2dG8gPSB1c2IuZGV2O1xuXG5cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuXG4gICAgICAgICAgICAgICAgaWYgKGRldnRvKSB7XG4gICAgICAgICAgICAgICAgICAgIHNldHN0cmluZyhjb25maWdGaWxlUGF0aCwgJ01vZGVtJywgZGV2dG8pLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZXRkZXYgPSBkZXZpY2U7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHsgc3VjY2VzczogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoeyBlcnJvcjogJ2Vycm9yIG9uIHNldHN0cmluZyAnIH0pO1xuICAgICAgICAgICAgICAgICAgICB9KVxuXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgICAgICAgICByZWplY3QoeyBlcnJvcjogJ2Vycm9yIG9uIG1vZGVtICcgfSk7XG5cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIH0pXG5cbiAgICAgICAgfSlcblxuICAgIH1cbiAgICBjb25maWd1cmUocHJvdmlkZXI6IElQcm92aWRlckNGKSB7XG4gICAgICAgIGxldCBkZXZpY2UgPSB0aGlzLmRldmljZTtcbiAgICAgICAgbGV0IGNvbmZpZ0ZpbGVQYXRoID0gdGhpcy5jb25maWdGaWxlUGF0aDtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlPHsgc3VjY2Vzcz86IGJvb2xlYW4gfT4oZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgICAgICBpZiAocHJvdmlkZXIpIHtcbiAgICAgICAgICAgICAgICBcbiAgICAgICBcbiAgICAgICAgICAgICAgICBpZiAoIXByb3ZpZGVyLnBob25lKSBwcm92aWRlci5waG9uZSA9ICcqOTkjJztcbiAgICAgICAgICAgICAgICBpZiAoIXByb3ZpZGVyLnVzZXJuYW1lKSBwcm92aWRlci51c2VybmFtZSA9ICcnO1xuICAgICAgICAgICAgICAgIGlmICghcHJvdmlkZXIucGFzc3dvcmQpIHByb3ZpZGVyLnBhc3N3b3JkID0gJyc7XG4gICAgICAgICBsZXQgc2V0cHJvdmlkZXI6SVByb3ZpZGVyPXtcbiAgICAgICAgICAgICAgICAgICAgYXBuOnByb3ZpZGVyLmFwbixcbiAgICAgICAgICAgICAgICAgICAgcGhvbmU6cHJvdmlkZXIucGhvbmUsXG4gICAgICAgICAgICAgICAgICAgIHVzZXJuYW1lOnByb3ZpZGVyLnVzZXJuYW1lLFxuICAgICAgICAgICAgICAgICAgICBwYXNzd29yZDpwcm92aWRlci5wYXNzd29yZFxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgaWYgKGRldmljZSkge1xuXG4gICAgICAgICAgICAgICAgICAgIHNldHByb3YoY29uZmlnRmlsZVBhdGgsIHNldHByb3ZpZGVyKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbHN1c2JkZXYoKS50aGVuKGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgZGV2dG86IGFueSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgdXNiID0gZGF0YVtpXTtcblxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh1c2IudHlwZSA9PSAnc2VyaWFsJyAmJiB1c2IuaHViID09IGRldmljZSAmJiAhZGV2dG8pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdzZXQgJyArIHVzYi5kZXYpXG5cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGV2dG8gPSB1c2IuZGV2O1xuXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGRldnRvKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNldHN0cmluZyhjb25maWdGaWxlUGF0aCwgJ01vZGVtJywgZGV2dG8pLnRoZW4oZnVuY3Rpb24oKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUoeyBzdWNjZXNzOiB0cnVlIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KS5jYXRjaChmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdCh7IGVycm9yOiAnZXJyb3Igb24gc2V0c3RyaW5nICcgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdCh7IGVycm9yOiAnZXJyb3Igb24gbW9kZW0gJyB9KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgfSlcblxuICAgICAgICAgICAgICAgICAgICB9KS5jYXRjaChmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdCh7IGVycm9yOiAnZXJyb3Igb24gc2V0cHJvdiAnIH0pO1xuICAgICAgICAgICAgICAgICAgICB9KVxuXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgICAgICAgICBleGVjKCdlY2hvIFwiW0RpYWxlciBEZWZhdWx0c11cIiA+ICcgKyBjb25maWdGaWxlUGF0aCkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGV4ZWMoJ2VjaG8gXFwnSW5pdDMgPSBBVCtDR0RDT05UPTEsXCJpcFwiLFwiJyArIHByb3ZpZGVyLmFwbiArICdcIiwsMCwwXFwnID4+ICcgKyBjb25maWdGaWxlUGF0aCkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBleGVjKCdlY2hvIFwiUGhvbmUgPSAnICsgcHJvdmlkZXIucGhvbmUgKyAnXCIgPj4gJyArIGNvbmZpZ0ZpbGVQYXRoKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBleGVjKCdlY2hvIFwiVXNlcm5hbWUgPSAnICsgcHJvdmlkZXIudXNlcm5hbWUgKyAnXCIgPj4gJyArIGNvbmZpZ0ZpbGVQYXRoKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXhlYygnZWNobyBcIlBhc3N3b3JkID0gJyArIHByb3ZpZGVyLnBhc3N3b3JkICsgJ1wiID4+ICcgKyBjb25maWdGaWxlUGF0aCkudGhlbihmdW5jdGlvbigpIHtcblxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXhlYygnd3ZkaWFsY29uZiAnICsgY29uZmlnRmlsZVBhdGgpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUoeyBzdWNjZXNzOiB0cnVlIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoeyBlcnJvcjogJ2Vycm9yIG9uIG1vZGVtICcgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcblxuXG5cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgfSlcblxuICAgICAgICAgICAgICAgICAgICB9KS5jYXRjaChmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdCh7IGVycm9yOiAnZXJyb3Igb24gb3BlbiAnICsgY29uZmlnRmlsZVBhdGggfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgfSk7XG5cblxuICAgICAgICAgICAgICAgIH1cblxuXG5cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVqZWN0KHsgZXJyb3I6ICdtdXN0IHB1c2ggYSBwcm92aWRlcicgfSk7XG5cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICB9O1xuXG5cbn07XG4iXSwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=
