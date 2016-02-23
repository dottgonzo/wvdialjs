var verb = require('verbo');
var Wv = require('../index.js');
var wvdialjs = new Wv('/etc/wvdial.conf');
wvdialjs.connect(true, "1-1.4").then(function () {
    verb('ok', 'info', 'connection');
}).catch(function (err) {
    verb(err, 'error', 'connection');
});

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInJ1bi9jb25uZWN0d2l0aGh1Yi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxJQUFJLElBQUksR0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUM7QUFDMUIsSUFBSSxFQUFFLEdBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxDQUFDO0FBQzlCLElBQUksUUFBUSxHQUFDLElBQUksRUFBRSxDQUFDLGtCQUFrQixDQUFDLENBQUM7QUFLeEMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDO0lBQ2xDLElBQUksQ0FBQyxJQUFJLEVBQUMsTUFBTSxFQUFDLFlBQVksQ0FBQyxDQUFBO0FBRWhDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxVQUFTLEdBQUc7SUFHbkIsSUFBSSxDQUFDLEdBQUcsRUFBQyxPQUFPLEVBQUMsWUFBWSxDQUFDLENBQUE7QUFDaEMsQ0FBQyxDQUFDLENBQUMiLCJmaWxlIjoicnVuL2Nvbm5lY3R3aXRoaHViLmpzIiwic291cmNlc0NvbnRlbnQiOlsidmFyIHZlcmI9cmVxdWlyZSgndmVyYm8nKTtcbnZhciBXdj1yZXF1aXJlKCcuLi9pbmRleC5qcycpO1xudmFyIHd2ZGlhbGpzPW5ldyBXdignL2V0Yy93dmRpYWwuY29uZicpO1xuXG5cblxuXG53dmRpYWxqcy5jb25uZWN0KHRydWUsXCIxLTEuNFwiKS50aGVuKGZ1bmN0aW9uKCl7XG4gIHZlcmIoJ29rJywnaW5mbycsJ2Nvbm5lY3Rpb24nKVxuXG59KS5jYXRjaChmdW5jdGlvbihlcnIpe1xuXG5cbiAgdmVyYihlcnIsJ2Vycm9yJywnY29ubmVjdGlvbicpXG59KTtcbiJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==