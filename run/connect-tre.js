"use strict";
var verb = require('verbo');
var index_1 = require('../index');
var config = {
    configFilePath: '/etc/wvdial.conf',
    provider: { "label": "Tre Ricaricabile", "apn": "tre.it", "phone": "*99#", "username": "tre", "password": "tre" }
};
var wvdialjs = new index_1.default(config);
wvdialjs.configure(true).then(function () {
    wvdialjs.connect(true).catch(function (err) {
        verb(err, 'error', 'connection');
    });
    setTimeout(function () {
        console.log(wvdialjs.status());
    }, 240000);
}).catch(function (err) {
    verb(err, "error", "error");
});

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInJ1bi9jb25uZWN0LXRyZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsSUFBSSxJQUFJLEdBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQzFCLHNCQUFlLFVBQVUsQ0FBQyxDQUFBO0FBRTFCLElBQUksTUFBTSxHQUFDO0lBQ1AsY0FBYyxFQUFDLGtCQUFrQjtJQUNqQyxRQUFRLEVBQUMsRUFBQyxPQUFPLEVBQUMsa0JBQWtCLEVBQUMsS0FBSyxFQUFDLFFBQVEsRUFBQyxPQUFPLEVBQUMsTUFBTSxFQUFDLFVBQVUsRUFBQyxLQUFLLEVBQUMsVUFBVSxFQUFDLEtBQUssRUFBQztDQUN4RyxDQUFBO0FBRUQsSUFBSSxRQUFRLEdBQUMsSUFBSSxlQUFFLENBQUMsTUFBTSxDQUFDLENBQUM7QUFHNUIsUUFBUSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUM7SUFDOUIsUUFBUSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsVUFBUyxHQUFHO1FBR3ZDLElBQUksQ0FBQyxHQUFHLEVBQUMsT0FBTyxFQUFDLFlBQVksQ0FBQyxDQUFBO0lBQ2hDLENBQUMsQ0FBQyxDQUFDO0lBQ0gsVUFBVSxDQUFDO1FBRVIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQTtJQUVqQyxDQUFDLEVBQUMsTUFBTSxDQUFDLENBQUE7QUFDVCxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsVUFBUyxHQUFHO0lBQ25CLElBQUksQ0FBQyxHQUFHLEVBQUMsT0FBTyxFQUFDLE9BQU8sQ0FBQyxDQUFBO0FBQzNCLENBQUMsQ0FBQyxDQUFBIiwiZmlsZSI6InJ1bi9jb25uZWN0LXRyZS5qcyIsInNvdXJjZXNDb250ZW50IjpbImxldCB2ZXJiPXJlcXVpcmUoJ3ZlcmJvJyk7XG5pbXBvcnQgV3YgZnJvbSAnLi4vaW5kZXgnO1xuXG5sZXQgY29uZmlnPXtcbiAgICBjb25maWdGaWxlUGF0aDonL2V0Yy93dmRpYWwuY29uZicsXG4gICAgcHJvdmlkZXI6e1wibGFiZWxcIjpcIlRyZSBSaWNhcmljYWJpbGVcIixcImFwblwiOlwidHJlLml0XCIsXCJwaG9uZVwiOlwiKjk5I1wiLFwidXNlcm5hbWVcIjpcInRyZVwiLFwicGFzc3dvcmRcIjpcInRyZVwifVxufVxuXG5sZXQgd3ZkaWFsanM9bmV3IFd2KGNvbmZpZyk7XG5cblxud3ZkaWFsanMuY29uZmlndXJlKHRydWUpLnRoZW4oZnVuY3Rpb24oKXtcbnd2ZGlhbGpzLmNvbm5lY3QodHJ1ZSkuY2F0Y2goZnVuY3Rpb24oZXJyKXtcblxuXG4gIHZlcmIoZXJyLCdlcnJvcicsJ2Nvbm5lY3Rpb24nKVxufSk7XG5zZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XG4gICAgXG4gICBjb25zb2xlLmxvZyh3dmRpYWxqcy5zdGF0dXMoKSkgXG4gICAgXG59LDI0MDAwMClcbn0pLmNhdGNoKGZ1bmN0aW9uKGVycil7XG4gIHZlcmIoZXJyLFwiZXJyb3JcIixcImVycm9yXCIpXG59KVxuXG5cblxuXG5cbiJdfQ==
