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
                hwrestart("reboot");
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
                if (device) {
                    setprov(this.configFilePath, provider).then(function () {
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

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImluZGV4LnRzIl0sIm5hbWVzIjpbInNldHN0cmluZyIsImdldHN0cmluZyIsImFsbHN0cmluZ3MiLCJjb25uZWN0Iiwid3Zjb25uZWN0Iiwic2V0cHJvdiIsImNvbnN0cnVjdG9yIiwic2V0VXNiIiwic2V0UHJvdmlkZXIiLCJnZXRDb25maWciLCJzZXRQYXJhbSIsImdldFBhcmFtIiwic3RhdHVzIiwic2V0ZGV2IiwiY29uZmlndXJlIl0sIm1hcHBpbmdzIjoiQUFBQSxJQUFZLE9BQU8sV0FBTSxVQUFVLENBQUMsQ0FBQTtBQUVwQyxJQUFZLEVBQUUsV0FBTSxJQUFJLENBQUMsQ0FBQTtBQUN6QixJQUFPLFFBQVEsV0FBVyxVQUFVLENBQUMsQ0FBQztBQUN0QyxJQUFJLFNBQVMsR0FBRyxPQUFPLENBQUMsV0FBVyxDQUFDLENBQUM7QUFFckMsSUFBSSxJQUFJLEdBQUcsT0FBTyxDQUFDLGVBQWUsQ0FBQyxDQUFDO0FBQ3BDLElBQUksSUFBSSxHQUFHLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQztBQUVsQyxJQUFJLElBQUksR0FBRyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUM7QUFFNUIsSUFBSSxZQUFZLEdBQUcsS0FBSyxDQUFDO0FBU3hCLENBQUM7QUF5QkYsbUJBQW1CLGNBQXNCLEVBQUUsR0FBRyxFQUFFLEdBQUc7SUFFL0NBLE1BQU1BLENBQUNBLElBQUlBLE9BQU9BLENBQXdCQSxVQUFTQSxPQUFPQSxFQUFFQSxNQUFNQTtRQUM5RCxTQUFTLENBQUMsY0FBYyxFQUFFLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFTLFNBQWlCO1lBQzFELElBQUksQ0FBQyxlQUFlLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsRUFBRSxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsS0FBSyxHQUFHLFNBQVMsQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUs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Q3BFLElBQUksQ0FBQyxtQkFBbUIsR0FBRyxRQUFRLENBQUMsUUFBUSxHQUFHLE9BQU8sR0FBRyxjQUFjLENBQUMsQ0FBQyxJQUFJLENBQUM7b0NBQzFFLElBQUksQ0FBQyxtQkFBbUIsR0FBRyxRQUFRLENBQUMsUUFBUSxHQUFHLE9BQU8sR0FBRyxjQUFjLENBQUMsQ0FBQyxJQUFJLENBQUM7d0NBRzFFLElBQUksQ0FBQyxhQUFhLEdBQUcsY0FBYyxDQUFDLENBQUMsSUFBSSxDQUFDOzRDQUN0QyxPQUFPLENBQUMsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQzt3Q0FDL0IsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLFVBQVMsR0FBRzs0Q0FDakIsTUFBTSxDQUFDLEVBQUUsS0FBSyxFQUFFLGlCQUFpQixFQUFFLENBQUMsQ0FBQzt3Q0FDekMsQ0FBQyxDQUFDLENBQUE7b0NBS04sQ0FBQyxDQUFDLENBQUE7Z0NBQ04sQ0FBQyxDQUFDLENBQUE7NEJBQ04sQ0FBQyxDQUFDLENBQUE7d0JBQ04sQ0FBQyxDQUFDLENBQUE7b0JBRU4sQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLFVBQVMsR0FBRzt3QkFDakIsTUFBTSxDQUFDLEVBQUUsS0FBSyxFQUFFLGdCQUFnQixHQUFHLGNBQWMsRUFBRSxDQUFDLENBQUM7b0JBRXpELENBQUMsQ0FBQyxDQUFDO2dCQUdQLENBQUM7WUFJTCxDQUFDO1lBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ0osTUFBTSxDQUFDLEVBQUUsS0FBSyxFQUFFLHNCQUFzQixFQUFFLENBQUMsQ0FBQztZQUU5QyxDQUFDO1FBQ0wsQ0FBQyxDQUFDQSxDQUFBQTtJQUNOQSxDQUFDQTs7SUFHTCxhQUFDO0FBQUQsQ0EvTVEsQUErTVAsR0FBQSxDQUFDIiwiZmlsZSI6ImluZGV4LmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgUHJvbWlzZSBmcm9tIFwiYmx1ZWJpcmRcIjtcbmltcG9ydCAqIGFzIHBhdGhFeGlzdHMgZnJvbSBcInBhdGgtZXhpc3RzXCI7XG5pbXBvcnQgKiBhcyBmcyBmcm9tIFwiZnNcIjtcbmltcG9ydCBsc3VzYmRldiA9IHJlcXVpcmUoXCJsc3VzYmRldlwiKTtcbmxldCBod3Jlc3RhcnQgPSByZXF1aXJlKCdod3Jlc3RhcnQnKTtcblxubGV0IGV4ZWMgPSByZXF1aXJlKCdwcm9taXNlZC1leGVjJyk7XG5sZXQgVGFpbCA9IHJlcXVpcmUoJ2Fsd2F5cy10YWlsJyk7XG5cbmxldCB2ZXJiID0gcmVxdWlyZSgndmVyYm8nKTtcblxubGV0IG1vYmlsZXN0YXR1cyA9IGZhbHNlO1xuXG4vL3NwYXduID0gcmVxdWlyZSgnY2hpbGRfcHJvY2VzcycpLnNwYXduLFxuXG5cbmludGVyZmFjZSBJQ29uZk9wdCB7XG4gICAgdmVyYm9zZT86IGJvb2xlYW47XG4gICAgZGV2PzogYW55O1xuICAgIHByb3ZpZGVyOiBJUHJvdmlkZXJDRjtcbn07XG5cblxuaW50ZXJmYWNlIElQcm92aWRlckNGIHtcblxuICAgIGxhYmVsPzogc3RyaW5nO1xuICAgIGFwbjogc3RyaW5nO1xuICAgIHBob25lPzogc3RyaW5nO1xuICAgIHVzZXJuYW1lPzogc3RyaW5nO1xuICAgIHBhc3N3b3JkPzogc3RyaW5nO1xuXG59XG5pbnRlcmZhY2UgSVByb3ZpZGVyIHtcblxuICAgIGxhYmVsPzogc3RyaW5nO1xuICAgIGFwbjogc3RyaW5nO1xuICAgIHBob25lOiBzdHJpbmc7XG4gICAgdXNlcm5hbWU6IHN0cmluZztcbiAgICBwYXNzd29yZDogc3RyaW5nO1xuXG59XG4vLyBtb2Rwcm9iZSB1c2JzZXJpYWxcbi8vIHd2ZGlhbGNvbmZcbi8vIHd2ZGlhbCBEZWZhdWx0cyAxPi9kZXYvbnVsbCAyPi9kZXYvbnVsbFxuXG5mdW5jdGlvbiBzZXRzdHJpbmcoY29uZmlnRmlsZVBhdGg6IHN0cmluZywga2V5LCB2YWwpIHtcblxuICAgIHJldHVybiBuZXcgUHJvbWlzZTx7IHN1Y2Nlc3M/OiBib29sZWFuIH0+KGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICBnZXRzdHJpbmcoY29uZmlnRmlsZVBhdGgsIGtleSkudGhlbihmdW5jdGlvbihvbGRzdHJpbmc6IHN0cmluZykge1xuICAgICAgICAgICAgZXhlYygnc2VkIC1pIC1lIFwicy8nICsga2V5WzBdLnRvVXBwZXJDYXNlKCkgKyBrZXkuc2xpY2UoMSkgKyAnID0gJyArIG9sZHN0cmluZy5yZXBsYWNlKC9cXCcvZywgJ1xcXFxcIicpLnJlcGxhY2UoL1xcLy9nLCAnXFxcXFxcLycpICsgJy8nICsga2V5WzBdLnRvVXBwZXJDYXNlKCkgKyBrZXkuc2xpY2UoMSkgKyAnID0gJyArIHZhbC5yZXBsYWNlKC9cXFwiL2csICdcXFxcXCInKS5yZXBsYWNlKC9cXC8vZywgJ1xcXFxcXC8nKSArICcvZ1wiICcgKyBjb25maWdGaWxlUGF0aCArICcnKS50aGVuKGZ1bmN0aW9uKHN0ZG91dCkge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoeyBzdWNjZXNzOiB0cnVlIH0pO1xuICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICAgICAgcmVqZWN0KHsgZXJyb3I6IGVyciB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KS5jYXRjaChmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgIHJlamVjdCh7IGVycm9yOiBlcnIgfSk7XG4gICAgICAgIH0pO1xuICAgIH0pO1xufVxuZnVuY3Rpb24gZ2V0c3RyaW5nKGNvbmZpZ0ZpbGVQYXRoOiBzdHJpbmcsIHBhcmFtKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICBhbGxzdHJpbmdzKGNvbmZpZ0ZpbGVQYXRoKS50aGVuKGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgICAgIGxldCB0ZXN0ID0gZmFsc2U7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IE9iamVjdC5rZXlzKGRhdGEpLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaWYgKE9iamVjdC5rZXlzKGRhdGEpW2ldID09IChwYXJhbVswXS50b1VwcGVyQ2FzZSgpICsgcGFyYW0uc2xpY2UoMSkpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRlc3QgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKGRhdGFbT2JqZWN0LmtleXMoZGF0YSlbaV1dKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIXRlc3QpIHtcbiAgICAgICAgICAgICAgICByZWplY3QoeyBlcnJvcjogXCJ3cm9uZyBwYXJhbVwiIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KS5jYXRjaChmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgIHJlamVjdCh7IGVycm9yOiBlcnIgfSk7XG4gICAgICAgIH0pXG4gICAgfSlcbn1cbmZ1bmN0aW9uIGFsbHN0cmluZ3MoY29uZmlnRmlsZVBhdGg6IHN0cmluZykge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcblxuICAgICAgICBleGVjKF9fZGlybmFtZSArICcvd3ZkaWFsLnNoICAtdCBcImdldFwiIC1jXCInICsgY29uZmlnRmlsZVBhdGggKyAnXCInKS50aGVuKGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgICAgIHJlc29sdmUoSlNPTi5wYXJzZShkYXRhKSk7XG4gICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgIH0pXG4gICAgfSlcbn1cblxuZnVuY3Rpb24gY29ubmVjdChjb25maWdGaWxlUGF0aDogc3RyaW5nLCB3YXRjaD86IGJvb2xlYW4sIGRldmljZT86IHN0cmluZykge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZTxib29sZWFuPihmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcblxuXG4gICAgICAgIGNvbnNvbGUubG9nKGRldmljZSlcblxuICAgICAgICBsZXQgZXhpc3QgPSBmYWxzZTtcbiAgICAgICAgbHN1c2JkZXYoKS50aGVuKGZ1bmN0aW9uKGRhdGE6IFt7IHR5cGU6IHN0cmluZywgZGV2OiBzdHJpbmcsIHByb2R1Y3Q6IHN0cmluZywgaHViOiBzdHJpbmcsIGlkOiBzdHJpbmcgfV0pIHtcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHZhciB1c2IgPSBkYXRhW2ldO1xuICAgICAgICAgICAgICAgIGlmICh1c2IudHlwZSA9PSAnc2VyaWFsJyAmJiAoZGV2aWNlICYmIHVzYi5odWIgPT0gZGV2aWNlKSB8fCAhZGV2aWNlKSB7XG4gICAgICAgICAgICAgICAgICAgIGV4aXN0ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJwYXNzMVwiKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICB9KVxuXG4gICAgICAgIGlmICghZXhpc3QpIGh3cmVzdGFydChcInJlYm9vdFwiKVxuICAgICAgICBcbiAgICAgICAgLy8gY2hlY2sgaWYgd3ZkaWFsLmNvbmYgdXNiIGlzIHByZXNlbnRcbiAgICAgICAgY29uc29sZS5sb2coY29uZmlnRmlsZVBhdGgpXG5cblxuICAgICAgICBsZXQgd3ZkaWFsZXJyID0gXCIvdG1wL1d2ZGlhbC5lcnJcIlxuICAgICAgICBsZXQgd3ZkaWFsb3V0ID0gXCIvdG1wL1d2ZGlhbC5vdXRcIlxuXG4gICAgICAgIGxldCBsbmNvdW50ID0gMDtcblxuICAgICAgICBmdW5jdGlvbiB3dmNvbm5lY3QoKSB7XG4gICAgICAgICAgICBtb2JpbGVzdGF0dXMgPSBmYWxzZTtcbiAgICAgICAgICAgIGlmIChsbmNvdW50ID4gMjAwKSB7XG5cblxuXG4gICAgICAgICAgICAgICAgaWYgKCF3YXRjaCkge1xuICAgICAgICAgICAgICAgICAgICB0YWlsLnVud2F0Y2goKTtcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KHRydWUpO1xuXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJyZWJvb3RcIilcbiAgICAgICAgICAgICAgICAgICAgaHdyZXN0YXJ0KFwidW5wbHVnXCIpO1xuICAgICAgICAgICAgICAgIH1cblxuXG5cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChkZXZpY2UpIHtcblxuXG4gICAgICAgICAgICAgICAgbHN1c2JkZXYoKS50aGVuKGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGRldnRvOiBhbnkgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBkYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgdXNiID0gZGF0YVtpXTtcblxuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodXNiLnR5cGUgPT0gJ3NlcmlhbCcgJiYgdXNiLmh1YiA9PSBkZXZpY2UgJiYgIWRldnRvKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ3NldCAnICsgdXNiLmRldilcblxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGV2dG8gPSB1c2IuZGV2O1xuXG5cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGRldnRvKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZXRzdHJpbmcoY29uZmlnRmlsZVBhdGgsICdNb2RlbScsIGRldnRvKS50aGVuKGZ1bmN0aW9uKCkge1xuXG5cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV4ZWMoJ3BraWxsIHd2ZGlhbCAmJiBzbGVlcCA1IDsgbW9kcHJvYmUgdXNic2VyaWFsJykudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXhlYygnc2xlZXAgNTsgd3ZkaWFsIERlZmF1bHRzIC1DICcgKyBjb25maWdGaWxlUGF0aCArICcgMT4nICsgd3ZkaWFsZXJyICsgJyAyPicgKyB3dmRpYWxvdXQpLmNhdGNoKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG5jb3VudCA9IGxuY291bnQgKyA2MFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgd3Zjb25uZWN0KClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGxuY291bnQpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBleGVjKCdzbGVlcCA1OyB3dmRpYWwgRGVmYXVsdHMgLUMgJyArIGNvbmZpZ0ZpbGVQYXRoICsgJyAxPicgKyB3dmRpYWxlcnIgKyAnIDI+JyArIHd2ZGlhbG91dCkuY2F0Y2goZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsbmNvdW50ID0gbG5jb3VudCArIDYwXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB3dmNvbm5lY3QoKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2cobG5jb3VudClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KS5jYXRjaChmdW5jdGlvbihlcnIpIHtcblxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coZXJyICsgXCIgc2V0IHN0cmluZyBlcnJvclwiKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxuY291bnQgPSBsbmNvdW50ICsgMzBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB3dmNvbm5lY3QoKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGxuY291bnQpXG5cblxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiIGVycjJcIilcbiAgICAgICAgICAgICAgICAgICAgICAgIGxuY291bnQgPSBsbmNvdW50ICsgMzBcbiAgICAgICAgICAgICAgICAgICAgICAgIHd2Y29ubmVjdCgpXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhsbmNvdW50KVxuXG5cblxuICAgICAgICAgICAgICAgICAgICB9XG5cblxuICAgICAgICAgICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgICAgICAgICBsbmNvdW50ID0gbG5jb3VudCArIDYwXG4gICAgICAgICAgICAgICAgICAgIHd2Y29ubmVjdCgpXG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGxuY291bnQpXG5cbiAgICAgICAgICAgICAgICB9KTtcblxuXG4gICAgICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAgICAgZXhlYygncGtpbGwgd3ZkaWFsICYmIHNsZWVwIDUgOyBtb2Rwcm9iZSB1c2JzZXJpYWwnKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICBleGVjKCdzbGVlcCA1OyB3dmRpYWwgRGVmYXVsdHMgLUMgJyArIGNvbmZpZ0ZpbGVQYXRoICsgJyAxPicgKyB3dmRpYWxlcnIgKyAnIDI+JyArIHd2ZGlhbG91dCkuY2F0Y2goZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsbmNvdW50ID0gbG5jb3VudCArIDYwXG4gICAgICAgICAgICAgICAgICAgICAgICB3dmNvbm5lY3QoKVxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2cobG5jb3VudClcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgIGV4ZWMoJ3NsZWVwIDU7IHd2ZGlhbCBEZWZhdWx0cyAtQyAnICsgY29uZmlnRmlsZVBhdGggKyAnIDE+JyArIHd2ZGlhbGVyciArICcgMj4nICsgd3ZkaWFsb3V0KS5jYXRjaChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxuY291bnQgPSBsbmNvdW50ICsgNjBcbiAgICAgICAgICAgICAgICAgICAgICAgIHd2Y29ubmVjdCgpXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhsbmNvdW50KVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgfVxuXG4gICAgICAgIH1cblxuICAgICAgICBmcy53cml0ZUZpbGVTeW5jKHd2ZGlhbGVyciwgXCJcIik7XG5cbiAgICAgICAgZnMud3JpdGVGaWxlU3luYyh3dmRpYWxvdXQsIFwiXCIpO1xuXG5cblxuICAgICAgICB2YXIgdGFpbCA9IG5ldyBUYWlsKHd2ZGlhbG91dCwgJ1xcbicpO1xuXG4gICAgICAgIHRhaWwub24oJ2xpbmUnLCBmdW5jdGlvbihkYXRhKSB7XG5cbiAgICAgICAgICAgIGxuY291bnQgPSBsbmNvdW50ICsgMTtcblxuXG4gICAgICAgICAgICBpZiAoZGF0YS5zcGxpdChcIkROU1wiKS5sZW5ndGggPT0gMikge1xuICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAvLyAgIGV4ZWMoJ2lwIHJvdXRlIGFkZCBkZWZhdWx0IGRldiBwcHAwJylcbiAgICAgICAgICAgICAgICAvLyB9LCAzMDAwMCk7XG4gICAgICAgICAgICAgICAgbW9iaWxlc3RhdHVzID0gdHJ1ZTtcblxuICAgICAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmMod3ZkaWFsZXJyLCBcIlwiKTtcblxuICAgICAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmMod3ZkaWFsb3V0LCBcIlwiKTtcblxuICAgICAgICAgICAgICAgIGxuY291bnQgPSAwO1xuXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ3BwcCBjb25uZWN0ZWQnKVxuXG4gICAgICAgICAgICAvLyAgICBpZiAoIXdhdGNoKSB7XG4gICAgICAgICAgICAvLyAgICAgICAgdGFpbC51bndhdGNoKCk7XG4gICAgICAgICAgICAgLy8gICAgICAgcmVzb2x2ZSh0cnVlKTtcblxuICAgICAgICAgICAgLy8gICAgfVxuXG5cblxuICAgICAgICAgICAgfSBlbHNlIGlmIChsbmNvdW50ID4gMjAwKSB7XG4gICAgICAgICAgICAgICAgbW9iaWxlc3RhdHVzID0gZmFsc2U7XG5cbiAgICAgICAgICAgICAgICBpZiAoIXdhdGNoKSB7XG4gICAgICAgICAgICAgICAgICAgIHRhaWwudW53YXRjaCgpO1xuICAgICAgICAgICAgICAgICAgICByZWplY3QodHJ1ZSk7XG5cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBod3Jlc3RhcnQoXCJ1bnBsdWdcIik7XG4gICAgICAgICAgICAgICAgfVxuXG5cblxuXG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICB9KTtcblxuXG4gICAgICAgIHRhaWwub24oJ2Vycm9yJywgZnVuY3Rpb24oZGF0YSkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coXCJ0YWlsZXJyb3JcIik7XG5cblxuICAgICAgICAgICAgaWYgKCF3YXRjaCkge1xuICAgICAgICAgICAgICAgIHRhaWwudW53YXRjaCgpO1xuICAgICAgICAgICAgICAgIHJlamVjdCh0cnVlKTtcblxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBod3Jlc3RhcnQoXCJyZWJvb3RcIik7XG4gICAgICAgICAgICB9XG5cblxuXG5cblxuXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRhaWwud2F0Y2goKTtcblxuICAgICAgICB3dmNvbm5lY3QoKVxuXG5cblxuXG5cblxuXG5cblxuICAgIH0pXG59XG5cblxuZnVuY3Rpb24gc2V0cHJvdihjb25maWdGaWxlUGF0aCwgcHJvdmlkZXI6IElQcm92aWRlckNGKSB7XG5cblxuXG5cbiAgICBpZiAoIXByb3ZpZGVyLnBob25lKSBwcm92aWRlci5waG9uZSA9ICcqOTkjJztcbiAgICBpZiAoIXByb3ZpZGVyLnVzZXJuYW1lKSBwcm92aWRlci51c2VybmFtZSA9ICcnO1xuICAgIGlmICghcHJvdmlkZXIucGFzc3dvcmQpIHByb3ZpZGVyLnBhc3N3b3JkID0gJyc7XG5cblxuICAgIHRoaXMucHJvdmlkZXIgPSBwcm92aWRlcjtcblxuICAgIHJldHVybiBuZXcgUHJvbWlzZTx7IHN1Y2Nlc3M/OiBib29sZWFuIH0+KGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICBpZiAocHJvdmlkZXIuYXBuKSB7XG4gICAgICAgICAgICBzZXRzdHJpbmcoY29uZmlnRmlsZVBhdGgsICdJbml0MycsICdBVCtDR0RDT05UPTEsXCJpcFwiLFwiJyArIHByb3ZpZGVyLmFwbiArICdcIiwsMCwwJykudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnb2sgYXBuJyk7XG4gICAgICAgICAgICAgICAgaWYgKHByb3ZpZGVyLnBob25lKSB7XG4gICAgICAgICAgICAgICAgICAgIHNldHN0cmluZyhjb25maWdGaWxlUGF0aCwgJ1Bob25lJywgcHJvdmlkZXIucGhvbmUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAocHJvdmlkZXIudXNlcm5hbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgc2V0c3RyaW5nKGNvbmZpZ0ZpbGVQYXRoLCAnVXNlcm5hbWUnLCBwcm92aWRlci51c2VybmFtZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChwcm92aWRlci5wYXNzd29yZCkge1xuICAgICAgICAgICAgICAgICAgICBzZXRzdHJpbmcoY29uZmlnRmlsZVBhdGgsICdQYXNzd29yZCcsIHByb3ZpZGVyLnBhc3N3b3JkKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmVzb2x2ZSh7IHN1Y2Nlc3M6IHRydWUgfSk7XG4gICAgICAgICAgICB9KVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVqZWN0KFwibm8gYXBuXCIpO1xuICAgICAgICB9XG4gICAgfSlcblxufTtcblxuXG5leHBvcnQgPWNsYXNzIFd2RGlhbCB7XG4gICAgY29uZmlnRmlsZVBhdGg6IHN0cmluZztcbiAgICBwcm92aWRlcjogSVByb3ZpZGVyQ0Y7XG4gICAgZGV2aWNlOiBhbnk7XG4gICAgY29uc3RydWN0b3IocGF0aDogc3RyaW5nLCBkZXZpY2U/OiBzdHJpbmcpIHtcbiAgICAgICAgaWYgKHBhdGgpIHtcbiAgICAgICAgICAgIHRoaXMuY29uZmlnRmlsZVBhdGggPSBwYXRoOyAvLyAvZXRjL3d2ZGlhbC5jb25mXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmNvbmZpZ0ZpbGVQYXRoID0gJy9ldGMvd3ZkaWFsLmNvbmYnO1xuICAgICAgICB9XG4gICAgICAgIGlmIChkZXZpY2UpIHtcbiAgICAgICAgICAgIHRoaXMuZGV2aWNlID0gZGV2aWNlOyAvLyAvZXRjL3d2ZGlhbC5jb25mXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmRldmljZSA9IGZhbHNlOyAvLyAvZXRjL3d2ZGlhbC5jb25mXG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgY29ubmVjdCh3YXRjaD86IGJvb2xlYW4pIHtcbiAgICAgICAgbGV0IGNvbmZpZ0ZpbGVQYXRoID0gdGhpcy5jb25maWdGaWxlUGF0aDtcbiAgICAgICAgbGV0IGRldiA9IHRoaXMuZGV2aWNlO1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2U8Ym9vbGVhbj4oZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnY29ubmVjdGlvbicpO1xuXG4gICAgICAgICAgICBnZXRzdHJpbmcoY29uZmlnRmlsZVBhdGgsICdNb2RlbScpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgY29ubmVjdChjb25maWdGaWxlUGF0aCwgd2F0Y2gsIGRldikudGhlbihmdW5jdGlvbihhbnN3ZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShhbnN3ZXIpO1xuICAgICAgICAgICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgcmVqZWN0KCdlcnIxJyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSlcbiAgICB9O1xuXG4gICAgc2V0VXNiKGRldmljZTogc3RyaW5nKSB7XG4gICAgICAgIGxldCBjb25maWdGaWxlUGF0aCA9IHRoaXMuY29uZmlnRmlsZVBhdGg7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZTx7IHN1Y2Nlc3M/OiBib29sZWFuIH0+KGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuXG4gICAgICAgICAgICBpZiAoZGV2aWNlKSB7XG4gICAgICAgICAgICAgICAgc2V0c3RyaW5nKGNvbmZpZ0ZpbGVQYXRoLCAnTW9kZW0nLCBkZXZpY2UucmVwbGFjZSgvXFwvL2csICdcXFxcXFwvJykpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoeyBzdWNjZXNzOiB0cnVlIH0pO1xuICAgICAgICAgICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcblxuICAgICAgICAgICAgICAgIH0pO1xuXG5cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVqZWN0KHsgZXJyb3I6IFwiTm8gZGV2aWNlIFwiICsgZGV2aWNlICsgXCIgZm91bmRlZFwiIH0pO1xuXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgfTtcblxuICAgIHNldFByb3ZpZGVyKHByb3ZpZGVyOiBJUHJvdmlkZXJDRikge1xuICAgICAgICByZXR1cm4gc2V0cHJvdih0aGlzLmNvbmZpZ0ZpbGVQYXRoLCBwcm92aWRlcilcblxuICAgIH07XG5cbiAgICBnZXRDb25maWcoKSB7XG4gICAgICAgIHJldHVybiBhbGxzdHJpbmdzKHRoaXMuY29uZmlnRmlsZVBhdGgpO1xuICAgIH07XG5cbiAgICBzZXRQYXJhbShrZXk6IHN0cmluZywgdmFsOiBzdHJpbmcpIHtcbiAgICAgICAgcmV0dXJuIHNldHN0cmluZyh0aGlzLmNvbmZpZ0ZpbGVQYXRoLCBrZXksIHZhbCk7XG4gICAgfTtcblxuICAgIGdldFBhcmFtKHBhcmFtOiBzdHJpbmcpIHtcbiAgICAgICAgcmV0dXJuIGdldHN0cmluZyh0aGlzLmNvbmZpZ0ZpbGVQYXRoLCBwYXJhbSk7XG4gICAgfTtcblxuICAgIHN0YXR1cygpIHtcblxuICAgICAgICByZXR1cm4gbW9iaWxlc3RhdHVzXG5cbiAgICB9XG4gICAgc2V0ZGV2KGRldmljZTogc3RyaW5nKSB7XG4gICAgICAgIGxldCBzZXRkZXYgPSB0aGlzLmRldmljZTtcbiAgICAgICAgbGV0IGNvbmZpZ0ZpbGVQYXRoID0gdGhpcy5jb25maWdGaWxlUGF0aDtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlPHsgc3VjY2Vzcz86IGJvb2xlYW4gfT4oZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgICAgICBsc3VzYmRldigpLnRoZW4oZnVuY3Rpb24oZGF0YSkge1xuICAgICAgICAgICAgICAgIGxldCBkZXZ0bzogYW55ID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBkYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciB1c2IgPSBkYXRhW2ldO1xuXG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHVzYi50eXBlID09ICdzZXJpYWwnICYmIHVzYi5odWIgPT0gZGV2aWNlICYmICFkZXZ0bykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ3NldCAnICsgdXNiLmRldilcblxuXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXZ0byA9IHVzYi5kZXY7XG5cblxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG5cbiAgICAgICAgICAgICAgICBpZiAoZGV2dG8pIHtcbiAgICAgICAgICAgICAgICAgICAgc2V0c3RyaW5nKGNvbmZpZ0ZpbGVQYXRoLCAnTW9kZW0nLCBkZXZ0bykudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNldGRldiA9IGRldmljZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUoeyBzdWNjZXNzOiB0cnVlIH0pO1xuICAgICAgICAgICAgICAgICAgICB9KS5jYXRjaChmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdCh7IGVycm9yOiAnZXJyb3Igb24gc2V0c3RyaW5nICcgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0pXG5cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAgICAgICAgIHJlamVjdCh7IGVycm9yOiAnZXJyb3Igb24gbW9kZW0gJyB9KTtcblxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgfSlcblxuICAgICAgICB9KVxuXG4gICAgfVxuICAgIGNvbmZpZ3VyZShwcm92aWRlcjogSVByb3ZpZGVyQ0YpIHtcbiAgICAgICAgbGV0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuICAgICAgICBsZXQgY29uZmlnRmlsZVBhdGggPSB0aGlzLmNvbmZpZ0ZpbGVQYXRoO1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2U8eyBzdWNjZXNzPzogYm9vbGVhbiB9PihmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgICAgIGlmIChwcm92aWRlcikge1xuICAgICAgICAgICAgICAgIGlmICghcHJvdmlkZXIucGhvbmUpIHByb3ZpZGVyLnBob25lID0gJyo5OSMnO1xuICAgICAgICAgICAgICAgIGlmICghcHJvdmlkZXIudXNlcm5hbWUpIHByb3ZpZGVyLnVzZXJuYW1lID0gJyc7XG4gICAgICAgICAgICAgICAgaWYgKCFwcm92aWRlci5wYXNzd29yZCkgcHJvdmlkZXIucGFzc3dvcmQgPSAnJztcblxuICAgICAgICAgICAgICAgIGlmIChkZXZpY2UpIHtcblxuICAgICAgICAgICAgICAgICAgICBzZXRwcm92KHRoaXMuY29uZmlnRmlsZVBhdGgsIHByb3ZpZGVyKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbHN1c2JkZXYoKS50aGVuKGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgZGV2dG86IGFueSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgdXNiID0gZGF0YVtpXTtcblxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh1c2IudHlwZSA9PSAnc2VyaWFsJyAmJiB1c2IuaHViID09IGRldmljZSAmJiAhZGV2dG8pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdzZXQgJyArIHVzYi5kZXYpXG5cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGV2dG8gPSB1c2IuZGV2O1xuXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGRldnRvKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNldHN0cmluZyhjb25maWdGaWxlUGF0aCwgJ01vZGVtJywgZGV2dG8pLnRoZW4oZnVuY3Rpb24oKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUoeyBzdWNjZXNzOiB0cnVlIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KS5jYXRjaChmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdCh7IGVycm9yOiAnZXJyb3Igb24gc2V0c3RyaW5nICcgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdCh7IGVycm9yOiAnZXJyb3Igb24gbW9kZW0gJyB9KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgfSlcblxuICAgICAgICAgICAgICAgICAgICB9KS5jYXRjaChmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdCh7IGVycm9yOiAnZXJyb3Igb24gc2V0cHJvdiAnIH0pO1xuICAgICAgICAgICAgICAgICAgICB9KVxuXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgICAgICAgICBleGVjKCdlY2hvIFwiW0RpYWxlciBEZWZhdWx0c11cIiA+ICcgKyBjb25maWdGaWxlUGF0aCkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGV4ZWMoJ2VjaG8gXFwnSW5pdDMgPSBBVCtDR0RDT05UPTEsXCJpcFwiLFwiJyArIHByb3ZpZGVyLmFwbiArICdcIiwsMCwwXFwnID4+ICcgKyBjb25maWdGaWxlUGF0aCkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBleGVjKCdlY2hvIFwiUGhvbmUgPSAnICsgcHJvdmlkZXIucGhvbmUgKyAnXCIgPj4gJyArIGNvbmZpZ0ZpbGVQYXRoKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBleGVjKCdlY2hvIFwiVXNlcm5hbWUgPSAnICsgcHJvdmlkZXIudXNlcm5hbWUgKyAnXCIgPj4gJyArIGNvbmZpZ0ZpbGVQYXRoKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXhlYygnZWNobyBcIlBhc3N3b3JkID0gJyArIHByb3ZpZGVyLnBhc3N3b3JkICsgJ1wiID4+ICcgKyBjb25maWdGaWxlUGF0aCkudGhlbihmdW5jdGlvbigpIHtcblxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXhlYygnd3ZkaWFsY29uZiAnICsgY29uZmlnRmlsZVBhdGgpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUoeyBzdWNjZXNzOiB0cnVlIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoeyBlcnJvcjogJ2Vycm9yIG9uIG1vZGVtICcgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcblxuXG5cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgfSlcblxuICAgICAgICAgICAgICAgICAgICB9KS5jYXRjaChmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdCh7IGVycm9yOiAnZXJyb3Igb24gb3BlbiAnICsgY29uZmlnRmlsZVBhdGggfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgfSk7XG5cblxuICAgICAgICAgICAgICAgIH1cblxuXG5cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVqZWN0KHsgZXJyb3I6ICdtdXN0IHB1c2ggYSBwcm92aWRlcicgfSk7XG5cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICB9O1xuXG5cbn07XG4iXSwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=
