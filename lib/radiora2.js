var events = require('events');
var util = require('util');
var net = require('net');

var RadioRa2 = function (host,username,password) {
    events.EventEmitter.call(this);
    var me = this;

    var readyForCommand = false;
    var loggedIn = false;
    var socket = null;
    var state = null;
    var commandQueue = [];
    var responderQueue = [];

    function sendUsername(prompt) {
        if (prompt != "login: ") {
            me.emit('error', (new Error("Bad initial response /"+prompt+"/")));
            return;
        }
        socket.write(username+"\r\n");
        state = sendPassword;
    }

    function sendPassword(prompt) {
        if (prompt != "password: ") {
            me.emit('error', (new Error("Bad login response /"+prompt+"/")));
            return;
        }
        state = incomingData;
        socket.write(password+"\r\n");
    }

    function incomingData(data) {
        var str = String(data), m;
        if (/GNET>\s/.test(str)) {
            if (!loggedIn) {
                me.emit('loggedIn');
            }
            readyForCommand = true;
            if (commandQueue.length) {
                var msg = commandQueue.shift();
                socket.write(msg);
                this.emit('sent', msg);
            }
            return;
        } else if ((m = /^~OUTPUT,(\d+),1,([\d\.]+)/.exec(str))) {
            me.emit("messageReceived", {type: 'status', id: m[1], level: m[2]});
        }
    }

    function messageReceived(message) {
        me.emit('messageReceived', message);
    }

    this.sendCommand = function (command) {
        if (!/\r\n$/.test(command)) {
            command += "\r\n";
        }
        if (readyForCommand) {
            readyForCommand = false;
            socket.write(command);
        } else {
            commandQueue.push(command);
        }
    };

    this.setDimmer = function (id,level,fade,delay,cb) {
        if (!cb) { cb = delay; delay = null; }
        if (!cb) { cb = fade; fade = null; }
        var result;
        result = function (msg) {
            if (msg.type == "status" && id == msg.id) {
                if (cb) {
                    cb(msg);
                }
                me.removeListener('messageReceived', result);
            }
        }
        me.on('messageReceived', result)
        var cmd = "#OUTPUT,"+id+",1,"+level;
        if (fade) {
            cmd += "," + fade;
            if (delay) {
                cmd += "," + delay;
            }
        }
        me.sendCommand(cmd);
    };

    this.setSwitch = function (id,on) {
        me.setDimmer(id,on?100:0);
    };

    this.queryOutput = function (id,cb) {
        var result;
        result = function (msg) {
            if (msg.type == "status" && id == msg.id) {
                if (cb) {
                    cb(msg);
                }
                me.removeListener('messageReceived', result);
            }
        }
        me.on('messageReceived', result)
        me.sendCommand("?OUTPUT,"+id+",1");
    };

    this.pressButton = function (id,btn) {
        me.sendCommand("#DEVICE,"+id+","+btn+",3");
    };

    this.connect = function () {
        socket = net.connect(23, host);
        socket.on('data', function(data) {
            console.log("RECEIVED>>"+String(data)+"<<");
            if (~data.indexOf("login")) sendUsername(data);
            if (~data.indexOf("password")) sendPassword(data);
            if (~data.indexOf("GNET")) incomingData(data);
        }).on('connect', function() {
        
	}).on('end', function() {
        
	});
    }
}

util.inherits(RadioRa2, events.EventEmitter);
exports.RadioRa2 = RadioRa2;
