var Promise = require("bluebird");
var fs = require("fs");
var hwrestart = require('hwrestart');
var exec = require('promised-exec');
var Tail = require('always-tail');
var verb = require('verbo');
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
function connect(configFilePath, watch) {
    return new Promise(function (resolve, reject) {
        console.log(configFilePath);
        var wvdialerr = "/tmp/Wvdial.err";
        var wvdialout = "/tmp/Wvdial.out";
        function wvconnect() {
            exec('pkill wvdial && sleep 5 ; modprobe usbserial').then(function () {
                exec('wvdial Defaults -C ' + configFilePath + ' 1>' + wvdialerr + ' 2>' + wvdialout).then(function () {
                    wvconnect();
                }).catch(function () {
                    wvconnect();
                });
            }).catch(function () {
                exec('wvdial Defaults -C ' + configFilePath + ' 1>' + wvdialerr + ' 2>' + wvdialout).then(function () {
                    wvconnect();
                }).catch(function () {
                    wvconnect();
                });
            });
        }
        fs.writeFileSync(wvdialerr, "");
        fs.writeFileSync(wvdialout, "");
        var tail = new Tail(wvdialout, '\n');
        var lncount = 0;
        tail.on('line', function (data) {
            lncount = lncount + 1;
            console.log(lncount + " got line:", data);
            if (data.split("DNS").length == 2) {
                fs.writeFileSync(wvdialerr, "");
                fs.writeFileSync(wvdialout, "");
                lncount = 0;
                if (!watch) {
                    tail.unwatch();
                    resolve(true);
                }
            }
            else if (data.split("Disconnect").length == 2) {
                if (!watch) {
                    tail.unwatch();
                    reject(true);
                }
                else {
                    wvconnect();
                }
            }
            else if (lncount > 200) {
                if (!watch) {
                    tail.unwatch();
                    reject(true);
                }
                else {
                    hwrestart("reboot");
                }
            }
        });
        tail.on('error', function (data) {
            console.log("tailerror");
            reject(data);
        });
        tail.watch();
        wvconnect();
    });
}
module.exports = (function () {
    function WvDial(path) {
        this.path = path;
        if (path) {
            this.configFilePath = path;
        }
        else {
            this.configFilePath = '/etc/wvdial.conf';
        }
    }
    ;
    WvDial.prototype.connect = function (watch) {
        var configFilePath = this.configFilePath;
        return new Promise(function (resolve, reject) {
            console.log('connection');
            getstring(configFilePath, 'Modem').then(function () {
                connect(configFilePath, watch).then(function (answer) {
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
        var configFilePath = this.configFilePath;
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
    WvDial.prototype.configure = function (provider) {
        var configFilePath = this.configFilePath;
        return new Promise(function (resolve, reject) {
            if (provider) {
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
                reject({ error: 'must push a provider' });
            }
        });
    };
    ;
    return WvDial;
})();

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImluZGV4LnRzIl0sIm5hbWVzIjpbInNldHN0cmluZyIsImdldHN0cmluZyIsImFsbHN0cmluZ3MiLCJjb25uZWN0Iiwid3Zjb25uZWN0IiwiY29uc3RydWN0b3IiLCJzZXRVc2IiLCJzZXRQcm92aWRlciIsImdldENvbmZpZyIsInNldFBhcmFtIiwiZ2V0UGFyYW0iLCJjb25maWd1cmUiXSwibWFwcGluZ3MiOiJBQUFBLElBQVksT0FBTyxXQUFNLFVBQVUsQ0FBQyxDQUFBO0FBRXBDLElBQVksRUFBRSxXQUFNLElBQUksQ0FBQyxDQUFBO0FBRXpCLElBQUksU0FBUyxHQUFHLE9BQU8sQ0FBQyxXQUFXLENBQUMsQ0FBQztBQUVyQyxJQUFJLElBQUksR0FBRyxPQUFPLENBQUMsZUFBZSxDQUFDLENBQUM7QUFDcEMsSUFBSSxJQUFJLEdBQUcsT0FBTyxDQUFDLGFBQWEsQ0FBQyxDQUFDO0FBRWxDLElBQUksSUFBSSxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQztBQXFCNUIsbUJBQW1CLGNBQXNCLEVBQUUsR0FBRyxFQUFFLEdBQUc7SUFFL0NBLE1BQU1BLENBQUNBLElBQUlBLE9BQU9BLENBQXdCQSxVQUFTQSxPQUFPQSxFQUFFQSxNQUFNQTtRQUM5RCxTQUFTLENBQUMsY0FBYyxFQUFFLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFTLFNBQWlCO1lBQzFELElBQUksQ0FBQyxlQUFlLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsRUFBRSxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsS0FBSyxHQUFHLFNBQVMsQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDLEdBQUcsR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLEVBQUUsR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLEtBQUss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LENBQUMsQ0FBQTt3QkFDTixDQUFDLENBQUMsQ0FBQTtvQkFDTixDQUFDLENBQUMsQ0FBQTtnQkFFTixDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsVUFBUyxHQUFHO29CQUNqQixNQUFNLENBQUMsRUFBRSxLQUFLLEVBQUUsZ0JBQWdCLEdBQUcsY0FBYyxFQUFFLENBQUMsQ0FBQztnQkFFekQsQ0FBQyxDQUFDLENBQUM7WUFJUCxDQUFDO1lBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ0osTUFBTSxDQUFDLEVBQUUsS0FBSyxFQUFFLHNCQUFzQixFQUFFLENBQUMsQ0FBQztZQUU5QyxDQUFDO1FBQ0wsQ0FBQyxDQUFDQSxDQUFBQTtJQUNOQSxDQUFDQTs7SUFHTCxhQUFDO0FBQUQsQ0ExSFEsQUEwSFAsR0FBQSxDQUFDIiwiZmlsZSI6ImluZGV4LmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgUHJvbWlzZSBmcm9tIFwiYmx1ZWJpcmRcIjtcbmltcG9ydCAqIGFzIHBhdGhFeGlzdHMgZnJvbSBcInBhdGgtZXhpc3RzXCI7XG5pbXBvcnQgKiBhcyBmcyBmcm9tIFwiZnNcIjtcblxubGV0IGh3cmVzdGFydCA9IHJlcXVpcmUoJ2h3cmVzdGFydCcpO1xuXG5sZXQgZXhlYyA9IHJlcXVpcmUoJ3Byb21pc2VkLWV4ZWMnKTtcbmxldCBUYWlsID0gcmVxdWlyZSgnYWx3YXlzLXRhaWwnKTtcblxubGV0IHZlcmIgPSByZXF1aXJlKCd2ZXJibycpO1xuLy9zcGF3biA9IHJlcXVpcmUoJ2NoaWxkX3Byb2Nlc3MnKS5zcGF3bixcblxuXG5cblxuaW50ZXJmYWNlIElQcm92aWRlciB7XG5cbiAgICBsYWJlbDogc3RyaW5nO1xuICAgIGFwbjogc3RyaW5nO1xuICAgIHBob25lOiBzdHJpbmc7XG4gICAgdXNlcm5hbWU6IHN0cmluZztcbiAgICBwYXNzd29yZDogc3RyaW5nO1xuXG59XG5cblxuLy8gbW9kcHJvYmUgdXNic2VyaWFsXG4vLyB3dmRpYWxjb25mXG4vLyB3dmRpYWwgRGVmYXVsdHMgMT4vZGV2L251bGwgMj4vZGV2L251bGxcblxuZnVuY3Rpb24gc2V0c3RyaW5nKGNvbmZpZ0ZpbGVQYXRoOiBzdHJpbmcsIGtleSwgdmFsKSB7XG5cbiAgICByZXR1cm4gbmV3IFByb21pc2U8eyBzdWNjZXNzPzogYm9vbGVhbiB9PihmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgZ2V0c3RyaW5nKGNvbmZpZ0ZpbGVQYXRoLCBrZXkpLnRoZW4oZnVuY3Rpb24ob2xkc3RyaW5nOiBzdHJpbmcpIHtcbiAgICAgICAgICAgIGV4ZWMoJ3NlZCAtaSAtZSBcInMvJyArIGtleVswXS50b1VwcGVyQ2FzZSgpICsga2V5LnNsaWNlKDEpICsgJyA9ICcgKyBvbGRzdHJpbmcucmVwbGFjZSgvXFwnL2csICdcXFxcXCInKS5yZXBsYWNlKC9cXC8vZywgJ1xcXFxcXC8nKSArICcvJyArIGtleVswXS50b1VwcGVyQ2FzZSgpICsga2V5LnNsaWNlKDEpICsgJyA9ICcgKyB2YWwucmVwbGFjZSgvXFxcIi9nLCAnXFxcXFwiJykucmVwbGFjZSgvXFwvL2csICdcXFxcXFwvJykgKyAnL2dcIiAnICsgY29uZmlnRmlsZVBhdGggKyAnJykudGhlbihmdW5jdGlvbihzdGRvdXQpIHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKHsgc3VjY2VzczogdHJ1ZSB9KTtcbiAgICAgICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgICAgIHJlamVjdCh7IGVycm9yOiBlcnIgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICByZWplY3QoeyBlcnJvcjogZXJyIH0pO1xuICAgICAgICB9KTtcbiAgICB9KTtcbn1cbmZ1bmN0aW9uIGdldHN0cmluZyhjb25maWdGaWxlUGF0aDogc3RyaW5nLCBwYXJhbSkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgYWxsc3RyaW5ncyhjb25maWdGaWxlUGF0aCkudGhlbihmdW5jdGlvbihkYXRhKSB7XG4gICAgICAgICAgICBsZXQgdGVzdCA9IGZhbHNlO1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBPYmplY3Qua2V5cyhkYXRhKS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGlmIChPYmplY3Qua2V5cyhkYXRhKVtpXSA9PSAocGFyYW1bMF0udG9VcHBlckNhc2UoKSArIHBhcmFtLnNsaWNlKDEpKSkge1xuICAgICAgICAgICAgICAgICAgICB0ZXN0ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShkYXRhW09iamVjdC5rZXlzKGRhdGEpW2ldXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCF0ZXN0KSB7XG4gICAgICAgICAgICAgICAgcmVqZWN0KHsgZXJyb3I6IFwid3JvbmcgcGFyYW1cIiB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICByZWplY3QoeyBlcnJvcjogZXJyIH0pO1xuICAgICAgICB9KVxuICAgIH0pXG59XG5mdW5jdGlvbiBhbGxzdHJpbmdzKGNvbmZpZ0ZpbGVQYXRoOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG5cbiAgICAgICAgZXhlYyhfX2Rpcm5hbWUgKyAnL3d2ZGlhbC5zaCAgLXQgXCJnZXRcIiAtY1wiJyArIGNvbmZpZ0ZpbGVQYXRoICsgJ1wiJykudGhlbihmdW5jdGlvbihkYXRhKSB7XG4gICAgICAgICAgICByZXNvbHZlKEpTT04ucGFyc2UoZGF0YSkpO1xuICAgICAgICB9KS5jYXRjaChmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICB9KVxuICAgIH0pXG59XG5cbmZ1bmN0aW9uIGNvbm5lY3QoY29uZmlnRmlsZVBhdGg6IHN0cmluZywgd2F0Y2g/OiBib29sZWFuKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPGJvb2xlYW4+KGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAvLyBjaGVjayBpZiB3dmRpYWwuY29uZiB1c2IgaXMgcHJlc2VudFxuICAgICAgICBjb25zb2xlLmxvZyhjb25maWdGaWxlUGF0aClcblxuXG4gICAgICAgIGxldCB3dmRpYWxlcnIgPSBcIi90bXAvV3ZkaWFsLmVyclwiXG4gICAgICAgIGxldCB3dmRpYWxvdXQgPSBcIi90bXAvV3ZkaWFsLm91dFwiXG5cblxuXG4gICAgICAgIGZ1bmN0aW9uIHd2Y29ubmVjdCgpIHtcblxuXG4gICAgICAgICAgICBleGVjKCdwa2lsbCB3dmRpYWwgJiYgc2xlZXAgNSA7IG1vZHByb2JlIHVzYnNlcmlhbCcpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgZXhlYygnd3ZkaWFsIERlZmF1bHRzIC1DICcgKyBjb25maWdGaWxlUGF0aCArICcgMT4nICsgd3ZkaWFsZXJyICsgJyAyPicgKyB3dmRpYWxvdXQpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgIHd2Y29ubmVjdCgpXG4gICAgICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgIHd2Y29ubmVjdCgpXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KS5jYXRjaChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBleGVjKCd3dmRpYWwgRGVmYXVsdHMgLUMgJyArIGNvbmZpZ0ZpbGVQYXRoICsgJyAxPicgKyB3dmRpYWxlcnIgKyAnIDI+JyArIHd2ZGlhbG91dCkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgd3Zjb25uZWN0KClcbiAgICAgICAgICAgICAgICB9KS5jYXRjaChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgd3Zjb25uZWN0KClcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuXG5cblxuICAgICAgICB9XG5cbiAgICAgICAgZnMud3JpdGVGaWxlU3luYyh3dmRpYWxlcnIsIFwiXCIpO1xuXG4gICAgICAgIGZzLndyaXRlRmlsZVN5bmMod3ZkaWFsb3V0LCBcIlwiKTtcblxuXG5cbiAgICAgICAgdmFyIHRhaWwgPSBuZXcgVGFpbCh3dmRpYWxvdXQsICdcXG4nKTtcbiAgICAgICAgbGV0IGxuY291bnQgPSAwO1xuICAgICAgICB0YWlsLm9uKCdsaW5lJywgZnVuY3Rpb24oZGF0YSkge1xuXG4gICAgICAgICAgICBsbmNvdW50ID0gbG5jb3VudCArIDE7XG5cbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGxuY291bnQgKyBcIiBnb3QgbGluZTpcIiwgZGF0YSk7XG4gICAgICAgICAgICBpZiAoZGF0YS5zcGxpdChcIkROU1wiKS5sZW5ndGggPT0gMikge1xuICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAvLyAgIGV4ZWMoJ2lwIHJvdXRlIGFkZCBkZWZhdWx0IGRldiBwcHAwJylcbiAgICAgICAgICAgICAgICAvLyB9LCAzMDAwMCk7XG5cblxuICAgICAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmMod3ZkaWFsZXJyLCBcIlwiKTtcblxuICAgICAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmMod3ZkaWFsb3V0LCBcIlwiKTtcblxuICAgICAgICAgICAgICAgIGxuY291bnQgPSAwO1xuXG5cblxuICAgICAgICAgICAgICAgIGlmICghd2F0Y2gpIHtcbiAgICAgICAgICAgICAgICAgICAgdGFpbC51bndhdGNoKCk7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUodHJ1ZSk7XG5cbiAgICAgICAgICAgICAgICB9XG5cblxuXG4gICAgICAgICAgICB9IGVsc2UgaWYgKGRhdGEuc3BsaXQoXCJEaXNjb25uZWN0XCIpLmxlbmd0aCA9PSAyKSB7XG5cbiAgICAgICAgICAgICAgICBpZiAoIXdhdGNoKSB7XG4gICAgICAgICAgICAgICAgICAgIHRhaWwudW53YXRjaCgpO1xuICAgICAgICAgICAgICAgICAgICByZWplY3QodHJ1ZSk7XG5cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB3dmNvbm5lY3QoKVxuICAgICAgICAgICAgICAgIH1cblxuXG5cblxuXG4gICAgICAgICAgICB9IGVsc2UgaWYgKGxuY291bnQgPiAyMDApIHtcblxuXG4gICAgICAgICAgICAgICAgaWYgKCF3YXRjaCkge1xuICAgICAgICAgICAgICAgICAgICB0YWlsLnVud2F0Y2goKTtcblxuICAgICAgICAgICAgICAgICAgICByZWplY3QodHJ1ZSk7XG5cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBod3Jlc3RhcnQoXCJyZWJvb3RcIik7XG4gICAgICAgICAgICAgICAgfVxuXG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICB9KTtcblxuXG4gICAgICAgIHRhaWwub24oJ2Vycm9yJywgZnVuY3Rpb24oZGF0YSkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coXCJ0YWlsZXJyb3JcIik7XG4gICAgICAgICAgICByZWplY3QoZGF0YSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRhaWwud2F0Y2goKTtcblxuICAgICAgICB3dmNvbm5lY3QoKVxuXG5cblxuXG5cblxuXG5cblxuICAgIH0pXG59XG5cblxuZXhwb3J0ID1jbGFzcyBXdkRpYWwge1xuICAgIGNvbmZpZ0ZpbGVQYXRoOiBzdHJpbmc7XG4gICAgcHJvdmlkZXI6IHN0cmluZztcbiAgICBjb25zdHJ1Y3RvcihwdWJsaWMgcGF0aDogc3RyaW5nKSB7XG4gICAgICAgIGlmIChwYXRoKSB7XG4gICAgICAgICAgICB0aGlzLmNvbmZpZ0ZpbGVQYXRoID0gcGF0aDsgLy8gL2V0Yy93dmRpYWwuY29uZlxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5jb25maWdGaWxlUGF0aCA9ICcvZXRjL3d2ZGlhbC5jb25mJztcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBjb25uZWN0KHdhdGNoPzogYm9vbGVhbikge1xuICAgICAgICBsZXQgY29uZmlnRmlsZVBhdGggPSB0aGlzLmNvbmZpZ0ZpbGVQYXRoO1xuXG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZTxib29sZWFuPihmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdjb25uZWN0aW9uJyk7XG5cbiAgICAgICAgICAgIGdldHN0cmluZyhjb25maWdGaWxlUGF0aCwgJ01vZGVtJykudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBjb25uZWN0KGNvbmZpZ0ZpbGVQYXRoLCB3YXRjaCkudGhlbihmdW5jdGlvbihhbnN3ZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShhbnN3ZXIpO1xuICAgICAgICAgICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgcmVqZWN0KCdlcnIxJyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSlcbiAgICB9O1xuXG4gICAgc2V0VXNiKGRldmljZTogc3RyaW5nKSB7XG4gICAgICAgIGxldCBjb25maWdGaWxlUGF0aCA9IHRoaXMuY29uZmlnRmlsZVBhdGg7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZTx7IHN1Y2Nlc3M/OiBib29sZWFuIH0+KGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuXG4gICAgICAgICAgICBpZiAoZGV2aWNlKSB7XG4gICAgICAgICAgICAgICAgc2V0c3RyaW5nKGNvbmZpZ0ZpbGVQYXRoLCAnTW9kZW0nLCBkZXZpY2UucmVwbGFjZSgvXFwvL2csICdcXFxcXFwvJykpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoeyBzdWNjZXNzOiB0cnVlIH0pO1xuICAgICAgICAgICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcblxuICAgICAgICAgICAgICAgIH0pO1xuXG5cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVqZWN0KHsgZXJyb3I6IFwiTm8gZGV2aWNlIFwiICsgZGV2aWNlICsgXCIgZm91bmRlZFwiIH0pO1xuXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgfTtcblxuICAgIHNldFByb3ZpZGVyKHByb3ZpZGVyOiBJUHJvdmlkZXIpIHtcbiAgICAgICAgbGV0IGNvbmZpZ0ZpbGVQYXRoID0gdGhpcy5jb25maWdGaWxlUGF0aDtcblxuICAgICAgICByZXR1cm4gbmV3IFByb21pc2U8eyBzdWNjZXNzPzogYm9vbGVhbiB9PihmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgICAgIGlmIChwcm92aWRlci5hcG4pIHtcbiAgICAgICAgICAgICAgICBzZXRzdHJpbmcoY29uZmlnRmlsZVBhdGgsICdJbml0MycsICdBVCtDR0RDT05UPTEsXCJpcFwiLFwiJyArIHByb3ZpZGVyLmFwbiArICdcIiwsMCwwJykudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ29rIGFwbicpO1xuICAgICAgICAgICAgICAgICAgICBpZiAocHJvdmlkZXIucGhvbmUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNldHN0cmluZyhjb25maWdGaWxlUGF0aCwgJ1Bob25lJywgcHJvdmlkZXIucGhvbmUpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmIChwcm92aWRlci51c2VybmFtZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2V0c3RyaW5nKGNvbmZpZ0ZpbGVQYXRoLCAnVXNlcm5hbWUnLCBwcm92aWRlci51c2VybmFtZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHByb3ZpZGVyLnBhc3N3b3JkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZXRzdHJpbmcoY29uZmlnRmlsZVBhdGgsICdQYXNzd29yZCcsIHByb3ZpZGVyLnBhc3N3b3JkKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHsgc3VjY2VzczogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZWplY3QoXCJubyBhcG5cIik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG5cbiAgICB9O1xuXG4gICAgZ2V0Q29uZmlnKCkge1xuICAgICAgICByZXR1cm4gYWxsc3RyaW5ncyh0aGlzLmNvbmZpZ0ZpbGVQYXRoKTtcbiAgICB9O1xuXG4gICAgc2V0UGFyYW0oa2V5LCB2YWwpIHtcbiAgICAgICAgcmV0dXJuIHNldHN0cmluZyh0aGlzLmNvbmZpZ0ZpbGVQYXRoLCBrZXksIHZhbCk7XG4gICAgfTtcblxuICAgIGdldFBhcmFtKHBhcmFtKSB7XG4gICAgICAgIHJldHVybiBnZXRzdHJpbmcodGhpcy5jb25maWdGaWxlUGF0aCwgcGFyYW0pO1xuICAgIH07XG5cblxuXG4gICAgY29uZmlndXJlKHByb3ZpZGVyKSB7XG4gICAgICAgIGxldCBjb25maWdGaWxlUGF0aCA9IHRoaXMuY29uZmlnRmlsZVBhdGg7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZTx7IHN1Y2Nlc3M/OiBib29sZWFuIH0+KGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAgICAgaWYgKHByb3ZpZGVyKSB7XG4gICAgICAgICAgICAgICAgZXhlYygnZWNobyBcIltEaWFsZXIgRGVmYXVsdHNdXCIgPiAnICsgY29uZmlnRmlsZVBhdGgpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgIGV4ZWMoJ2VjaG8gXFwnSW5pdDMgPSBBVCtDR0RDT05UPTEsXCJpcFwiLFwiJyArIHByb3ZpZGVyLmFwbiArICdcIiwsMCwwXFwnID4+ICcgKyBjb25maWdGaWxlUGF0aCkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGV4ZWMoJ2VjaG8gXCJQaG9uZSA9ICcgKyBwcm92aWRlci5waG9uZSArICdcIiA+PiAnICsgY29uZmlnRmlsZVBhdGgpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZXhlYygnZWNobyBcIlVzZXJuYW1lID0gJyArIHByb3ZpZGVyLnVzZXJuYW1lICsgJ1wiID4+ICcgKyBjb25maWdGaWxlUGF0aCkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXhlYygnZWNobyBcIlBhc3N3b3JkID0gJyArIHByb3ZpZGVyLnBhc3N3b3JkICsgJ1wiID4+ICcgKyBjb25maWdGaWxlUGF0aCkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV4ZWMoJ3d2ZGlhbGNvbmYgJyArIGNvbmZpZ0ZpbGVQYXRoKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUoeyBzdWNjZXNzOiB0cnVlIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KHsgZXJyb3I6ICdlcnJvciBvbiBtb2RlbSAnIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgfSlcblxuICAgICAgICAgICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uKGVycikge1xuICAgICAgICAgICAgICAgICAgICByZWplY3QoeyBlcnJvcjogJ2Vycm9yIG9uIG9wZW4gJyArIGNvbmZpZ0ZpbGVQYXRoIH0pO1xuXG4gICAgICAgICAgICAgICAgfSk7XG5cblxuXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJlamVjdCh7IGVycm9yOiAnbXVzdCBwdXNoIGEgcHJvdmlkZXInIH0pO1xuXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgfTtcblxuXG59O1xuIl0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9
