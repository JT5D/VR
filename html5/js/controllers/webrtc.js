var peers = [],
    channels = [],
    myIndex = null;
    
include(0,
    ["/socket.io/socket.io.js",        
    "js/input/NetworkedInput.js",
    "js/input/ButtonAndAxisInput.js",
    "js/input/KeyboardInput.js"],
    webRTCTest);

function webRTCTest(){
    var ctrls = findEverything(),
        socket = io.connect(document.location.hostname, {
            "reconnect": true,
            "reconnection delay": 1000,
            "max reconnection attempts": 60
        });
    
    function showMessage(msg){
        var div = document.createElement("div");
        div.appendChild(document.createTextNode(msg));
        ctrls.output.appendChild(div);
        return div;
    }
    
    function setChannelEvents(index){
        channels[index].addEventListener("message", function(evt){
            showMessage(fmt("< ($1): $2", index, evt.data));
        }, false);
        channels[index].addEventListener("open", function(){
            ctrls.input.disabled = false;
        }, false);
        
        function closer(name){
            console.error("channel " + name);
            channels[index] = null;
            peers[index] = null;
            ctrls.input.disabled = (filter(channels, function(c){ return c; }).length === 0);            
        }
        
        channels[index].addEventListener("error", closer.bind(this, "errored"), false);
        channels[index].addEventListener("close", closer.bind(this, "closed"), false);
    }
    
    ctrls.input.addEventListener("change", function(){
        for(var i = 0; i < channels.length; ++i){
            var channel = channels[i];
            if(channel && channel.readyState === "open"){
                channel.send(ctrls.input.value);
            }
        }
        showMessage(fmt("> ($1): $2", myIndex, ctrls.input.value));
        ctrls.input.value = "";
    }, false);
    
    window.addEventListener("unload", function(){
        for(var i = 0; i < channels.length; ++i){
            var channel = channels[i];
            if(channel && channel.readyState === "open"){
                channel.close();
            }
        }
    });
    
    socket.on("connect", function(){
        socket.emit("handshake", "peer");        
    });
    
    socket.on("handshakeComplete", function(name){
        if(name === "peer"){
            socket.emit("joinRequest", "webrtc-demo");
        }
    });
    
    socket.on("user", function(index, theirIndex){
        try{
            if(myIndex === null){
                myIndex = index;
            }
            console.log(myIndex, theirIndex);
            if(!peers[theirIndex]){                
                var peer = new RTCPeerConnection(null);                
                peers[theirIndex] = peer;

                peer.addEventListener("icecandidate", function(evt){
                    if(evt.candidate){
                        evt.candidate.fromIndex = myIndex;
                        evt.candidate.toIndex = theirIndex;
                        socket.emit("ice", evt.candidate);
                    }
                }, false);
            
                function descriptionCreated(description){
                    description.fromIndex = myIndex;
                    description.toIndex = theirIndex;
                    peers[theirIndex].setLocalDescription(description, function(){
                        socket.emit(description.type, description);
                    });
                }
    
                function descriptionReceived(description, thunk){
                    console.debug("sdp received", description.toIndex, myIndex, description.fromIndex, theirIndex);
                    if(description.fromIndex === theirIndex){
                        var remote = new RTCSessionDescription(description);
                        peers[theirIndex].setRemoteDescription(remote, thunk);
                    }
                }

                socket.on("ice", function(ice){
                    console.debug("ice received", ice.toIndex, myIndex, ice.fromIndex, theirIndex);
                    if(ice.fromIndex === theirIndex){
                        peers[theirIndex].addIceCandidate(new RTCIceCandidate(ice));
                    }
                });
                
                if(myIndex < theirIndex){
                    var channel = peer.createDataChannel("data-channel-" + myIndex + "-to-" + theirIndex, {
                        id: myIndex,
                        ordered: false
                    });
                    channels[theirIndex] = channel;
                    setChannelEvents(theirIndex);  

                    socket.on("answer", function(answer){
                        console.debug("answer", answer.toIndex, myIndex, answer.fromIndex, theirIndex);
                        if(answer.fromIndex === theirIndex){
                            descriptionReceived(answer);
                        }
                    });
                    
                    peer.createOffer(descriptionCreated, console.error.bind(console, "createOffer error"));            
                }
                else{
                    peer.addEventListener("datachannel", function(evt){
                        console.debug("datachannel", evt.channel.id, theirIndex);
                        if(evt.channel.id === theirIndex){
                            channels[evt.channel.id] = evt.channel;
                            setChannelEvents(theirIndex);
                        }
                    }, false);
                
                    socket.on("offer", function(offer){
                        console.debug("offer", offer.toIndex, myIndex, offer.fromIndex, theirIndex);
                        if(offer.fromIndex === theirIndex){
                            descriptionReceived(offer, function(){
                                peers[theirIndex].createAnswer(
                                    descriptionCreated,
                                    console.error.bind(console, "createAnswer error"));
                            });
                        }
                    });
                }
            }
        }
        catch(exp){
            console.error(exp);
        }
    });
}