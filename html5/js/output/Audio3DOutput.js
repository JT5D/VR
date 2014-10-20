function Audio3DOutput(){
    try{
        this.audioContext = new AudioContext();
        this.mainVolume = this.audioContext.createGain();
        this.mainVolume.connect(this.audioContext.destination);

        this.setPosition = this.audioContext.listener.setPosition.bind(this.audioContext.listener);
        this.setVelocity = this.audioContext.listener.setVelocity.bind(this.audioContext.listener);
        this.setOrientation = this.audioContext.listener.setOrientation.bind(this.audioContext.listener);
        this.isAvailable = true;
    }
    catch(exp){
        this.isAvailable = false;
        this.setPosition = function(){};
        this.setVelocity = function(){};
        this.setOrientation = function(){};
        this.error = exp;
        console.error("AudioContext not available. Reason: ", exp.message);
    }
}

Audio3DOutput.prototype.loadBuffer = function(src, progress, success){
    if(!success){
        success = progress;
        progress = null;
    }
    
    if(!success){
        throw new Error("You need to provide a callback function for when the audio finishes loading");
    }
    
    // just overlook the lack of progress indicator
    if(!progress){
        progress = function(){};
    }
    
    var error = function(){ 
        progress("error", src); 
    };
    
    if(this.isAvailable){
        progress("loading", src);
        var xhr = new XMLHttpRequest();
        xhr.open("GET", src);
        xhr.responseType = "arraybuffer";
        xhr.onerror = error;
        xhr.onabort = error;
        xhr.onprogress = function(evt){ 
            progress("intermediate", src, evt.loaded); 
        };
        xhr.onload = function () {
            if (xhr.status < 400) {
                progress("success", src);
                this.audioContext.decodeAudioData(xhr.response, success, error);
            }
            else {
                error();
            }
        }.bind(this);
        xhr.send();
    }
    else{
        error();
    }
};

Audio3DOutput.prototype.loadBufferCascadeSrcList = function(srcs, progress, success, index){
    index = index || 0;
    if(index === srcs.length){
        if(progress){
            srcs.forEach(function(s){
                progress("error", s);
            });
        }
    }
    else{
        var userProgress = progress;
        progress = function(type, file, data){
            if(userProgress){
                userProgress(type, file, data);
            }
            if(type === "error"){
                setTimeout(this.loadBufferCascadeSrcList.bind(this, srcs, userProgress, success, index + 1), 0);
            }
        };
        this.loadBuffer(srcs[index], progress, success);
    }
};

Audio3DOutput.prototype.createSound = function(loop, success, buffer){
    var snd = {
        volume: this.audioContext.createGain(),
        source: this.audioContext.createBufferSource()
    };
    snd.source.buffer = buffer;
    snd.source.loop = loop;
    success(snd);
};

Audio3DOutput.prototype.create3DSound = function(x, y, z, success, snd){
    snd.panner = this.audioContext.createPanner();
    snd.panner.setPosition(x, y, z);
    snd.panner.connect(this.mainVolume);
    snd.volume.connect(snd.panner);
    snd.source.connect(snd.volume);
    success(snd);  
};

Audio3DOutput.prototype.createFixedSound = function(success, snd){
    snd.volume.connect(this.mainVolume);
    snd.source.connect(snd.volume);
    success(snd); 
};

Audio3DOutput.prototype.loadSound = function(src, loop, progress, success){
    this.loadBuffer(src, progress, this.createSound.bind(this, loop, success));
};

Audio3DOutput.prototype.loadSoundCascadeSrcList = function(srcs, loop, progress, success, index){
    this.loadBufferCascadeSrcList(srcs, progress, this.createSound.bind(this, loop, success));
};

Audio3DOutput.prototype.loadSound3D = function(src, loop, x, y, z, progress, success){
    this.loadSound(src, loop, progress, this.create3DSound.bind(this, x, y, z, success));
};

Audio3DOutput.prototype.loadSound3DCascadeSrcList = function(srcs, loop, x, y, z, progress, success){
    this.loadSoundCascadeSrcList()(srcs, loop, progress, this.create3DSound.bind(this, x, y, z, success));    
};

Audio3DOutput.prototype.loadSoundFixed = function(src, loop, progress, success){
    this.loadSound(src, loop, progress, this.createFixedSound .bind(this, success));  
};

Audio3DOutput.prototype.loadSoundFixedCascadeSrcList = function(srcs, loop, progress, success){
    this.loadSoundCascadeSrcList(srcs, loop, progress, this.createFixedSound .bind(this, success));  
};

Audio3DOutput.prototype.playBufferImmediate = function(buffer){
    this.createSound(false, this.createFixedSound.bind(this, function(snd){        
        snd.volume.gain.value = 1;
        snd.source.addEventListener("ended", function(evt){
            snd.volume.disconnect(this.mainVolume);
        }.bind(this));
        snd.source.start(0);
    }), buffer);
};
/*
https://www.github.com/capnmidnight/VR
Copyright (c) 2014 Sean T. McBeth
All rights reserved.

Redistribution and use in source and binary forms, with or without modification, 
are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this 
  list of conditions and the following disclaimer.

* Redistributions in binary form must reproduce the above copyright notice, this 
  list of conditions and the following disclaimer in the documentation and/or 
  other materials provided with the distribution.

* Neither the name of Sean T. McBeth nor the names of its contributors
  may be used to endorse or promote products derived from this software without 
  specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND 
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED 
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. 
IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, 
INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, 
BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, 
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF 
LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE 
OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED 
OF THE POSSIBILITY OF SUCH DAMAGE.
*/