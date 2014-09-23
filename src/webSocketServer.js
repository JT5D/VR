﻿var types = ["gamepad", "keyboard", "mouse", "touch", "motion", "speech"],
    users = {},
    fmt = require("./core.js").fmt;

function User(userName, password){
    this.devices = [];
    this.state = {
        x: 0,
        y: 0,
        z: 0,
        dx: 0,
        dy: 0,
        dz: 0,
        heading: 0,
        isRunning: false,
        userName: userName
    };
    this.password = password;
}

User.prototype.addDevice = function(socket){
    var index = 0;
    while(index < this.devices.length && this.devices[index]){
        ++index;
    }

    this.devices[index] = socket;
    this.bindEvents(index, this);

    if(index > 0){
        this.emit(index, "deviceAdded");
        this.devices[index].emit("userState", this.state);
    }
};

User.prototype.bindEvents = function(index){
    for(var i = 0; i < types.length; ++i) {
        this.devices[index].on(types[i], User.prototype.emit.bind(this, index, types[i]));
    }

    this.devices[index].on("disconnect", User.prototype.disconnect.bind(this, index));

    this.devices[index].on("userState", function(state){
        this.state.x = state.x;
        this.state.y = state.y;
        this.state.z = state.z;
        this.state.heading = state.heading;
        this.state.isRunning = state.isRunning;
        this.broadcast(index, "userState", this.state);
    }.bind(this));
    
    var userList = [];
    for(var userName in users){
        if(users[userName].isConnected()){
            userList.push(userName);
        }
    }
    this.devices[index].emit("userList", userList);
    if(index == 0){
        this.broadcast(index, "userJoin", this.state.userName);
    }
};

User.prototype.broadcast = function(skipIndex){
    var args = Array.prototype.slice.call(arguments, 1);
    for(var userName in users){
        var toUser = users[userName];
        toUser.emit
            .bind(toUser, (userName == this.state.userName) ? skipIndex : -1)
            .apply(toUser, args);
    }
};

User.prototype.emit = function(skipIndex){
    var args = Array.prototype.slice.call(arguments, 1);
    for(var i = 0; i < this.devices.length; ++i){
        if(i != skipIndex && this.devices[i]){
            this.devices[i].emit.apply(this.devices[i], args);
        }
    }
};

User.prototype.isConnected = function(){
    var devicesLeft = 0;
    for(var i = 0; i < this.devices.length; ++i){
        if(this.devices[i]){
            ++devicesLeft;
        }
    }
    return devicesLeft > 0;
};

User.prototype.disconnect = function(index, reason){
    this.devices[index] = null;
    if(this.isConnected()){
        this.emit(index, "deviceLost");
    }
    else{
        console.log("disconnect", this.state.userName);
        this.broadcast(-1, "userLeft", this.state.userName);
        this.devices.splice(0);
    }
};

module.exports = function (socket) {
    console.log("New connection!");
    function login(credentials){
        if(!users[credentials.userName]){
            console.log("new user", credentials.userName);
            users[credentials.userName] = new User(credentials.userName, credentials.password);
        }
        
        if(users[credentials.userName].password == credentials.password){
            if(!users[credentials.userName].isConnected()){
                console.log("user login", credentials.userName);
            }
            users[credentials.userName].addDevice(socket);
            socket.removeListener("login", login);
        }
        else{
            console.log("Failed to authenticate!", credentials.userName);
            socket.emit("loginFailed");
        }
    }
    socket.on("login", login);
}