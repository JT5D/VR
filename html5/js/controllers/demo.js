var isDebug = false,
    isLocal = document.location.hostname === "localhost",
    ctrls = findEverything(),
    tabs = makeTabSet(ctrls.options),
    PLAYER_HEIGHT = 6,
    formState = getSetting("formState"),
    login,
    prog = new LoadingProgress(
        "manifest/js/controllers/demo.js?v2",
        "lib/three/three.js",
        "lib/three/StereoEffect.js",
        "lib/three/OculusRiftEffect.js",
        "lib/three/AnaglyphEffect.js",
        "lib/three/ColladaLoader.js",
        "lib/three/JSONLoader.js",
        "lib/three/SceneLoader.js",
        "lib/droid_sans_regular.typeface.js",
        "/socket.io/socket.io.js",
        "js/oscope/oscope.client.js",
        "js/ModelLoader.js",
        "js/input/NetworkedInput.js",
        "js/input/ButtonAndAxisInput.js",
        "js/input/SpeechInput.js",
        "js/input/GamepadInput.js",
        "js/input/KeyboardInput.js",
        "js/input/MotionInput.js",
        "js/input/MouseInput.js",
        "js/input/TouchInput.js",
        "js/output/Audio3DOutput.js",
        "js/output/SpeechOutput.js",
        "js/vui/vui.js",
        displayProgress,
        postScriptLoad);

writeForm(ctrls, formState);

function displayProgress(file) {
    ctrls.triedSoFar.style.width = prog.makeSize(FileState.NONE, "size");
    ctrls.processedSoFar.style.width = prog.makeSize(FileState.STARTED | FileState.ERRORED | FileState.COMPLETE, "progress");
    ctrls.loadedSoFar.style.width = prog.makeSize(FileState.COMPLETE, "size");
    if (typeof (file) !== "string") {
        file = fmt(
            "<br>$1:<br>[msg] $2<br>[line] $3<br>[col] $4<br>[file] $5",
            typeof (file),
            file.message,
            file.line,
            file.column,
            file.sourceURL.match(/[^\/\\]*$/)[0]
        );
    }
    ctrls.loadingMessage.innerHTML
            = ctrls.connectButton.innerHTML
            = fmt("Loading, please wait... $1 $2", file, ctrls.processedSoFar.style.width);
    ctrls.loadedSoFar.style.left = ctrls.errorSoFar.style.width = prog.makeSize(FileState.ERRORED, "size");
    if (prog.isDone()) {
        ctrls.loading.style.display = "none";
        ctrls.connectButton.addEventListener("click", login, false);
        ctrls.connectButton.innerHTML = "Connect";
        ctrls.loadingMessage.innerHTML = "Loading complete!";
        setTimeout(function () {
            ctrls.loadingMessage.style.visibility = "hidden";
        }, 2000);

        if (ctrls.autoLogin.checked
                && ctrls.userNameField.value.length > 0
                && ctrls.passwordField.value.length > 0) {
            login();
        }
    }
}

function postScriptLoad(progress) {
    var BG_COLOR = 0xafbfff, CLUSTER = 2, CHAT_TEXT_SIZE = 0.25,
        TRACKING_SCALE = 0, TRACKING_SCALE_COMP = 1 - TRACKING_SCALE,
        GRAVITY = 9.8, SPEED = 15,
        pitch = 0, roll = 0, heading = 0, lastHeading = 0, dheading = 0,
        vcx = 0, vcy = 0, vcz = 0,
        onground = false,
        head, arm, keyboard, mouse, gamepad, touch, speech,
        dt, lt = 0, frame = 0, dFrame = 0.125,
        userName = null,
        chatLines = [],
        audio3d = new Audio3DOutput(),
        oceanSound = null,
        socket = io.connect(document.location.hostname, {
            "reconnect": true,
            "reconnection delay": 1000,
            "max reconnection attempts": 60
        }),
        oscope = new Oscope("demo"),
        bears = {}, pointer, heightmap, lastText,
        nameMaterial = new THREE.MeshLambertMaterial({
            color: 0xdfdf7f,
            shading: THREE.FlatShading
        }),
        camera, effect, drawDistance = 250,
        scene = null,
        renderer = new THREE.WebGLRenderer({antialias: true});

    oscope.connect();
    socket.on("handshakeFailed", console.warn.bind(console, "Failed to connect to websocket server. Available socket controllers are:"));
    socket.on("handshakeComplete", function(controller){
        if(controller === "demo"){
            console.log("Connected to websocket server.")
        }
    });
    socket.on("loginFailed", msg.bind(window, "Incorrect user name or password!"));
    socket.on("userList", listUsers);
    socket.on("userJoin", addUser);
    socket.on("userState", updateUserState);
    socket.on("typing", showTyping.bind(window, false, false));
    socket.on("chat", showChat);
    socket.on("userLeft", userLeft);
    socket.on("disconnect", msg.bind(window));
    socket.emit("handshake", "demo");

    tabs.style.width = pct(100);
    renderer.setClearColor(BG_COLOR);

    function msg() {
        var txt = map(arguments, function (v) {
            return v ? v.toString() : "";
        }).join(" ");
        if (isDebug) {
            console.log.apply(console, arguments);
        }
        else if (bears[userName]) {
            showChat(txt);
        }
        else {
            alert(txt);
        }
    }

    function ask(txt, force) {
        if (isDebug) {
            return force;
        }
        else {
            return confirm(txt);
        }
    }

    function update(dt) {
        vcz -= dt * GRAVITY;
        var x = Math.floor((camera.position.x - heightmap.minX) / CLUSTER);
        var y = Math.floor((camera.position.y - heightmap.minY) / CLUSTER);
        var z = PLAYER_HEIGHT;
        if (heightmap
            && 0 <= y && y < heightmap.length
            && 0 <= x && x < heightmap[y].length) {
            z += heightmap[y][x];
        }

        if (camera.position.z <= z && vcz <= 0) {
            vcz = 0;
            camera.position.z = camera.position.z * 0.75 + z * 0.25;
            if (!onground) {
                navigator.vibrate(100);
            }
            onground = true;
        }

        if (onground) {
            var tx = keyboard.getValue("strafeRight")
                    + keyboard.getValue("strafeLeft")
                    + gamepad.getValue("strafe");
            var ty = keyboard.getValue("driveBack")
                    + keyboard.getValue("driveForward")
                    + gamepad.getValue("drive")
                    + touch.getValue("drive");
            if (tx || ty) {
                len = SPEED * Math.min(1, 1 / Math.sqrt(ty * ty + tx * tx));

                //if (bears[userName] && !bears[userName].animation.isPlaying) {
                //    bears[userName].animation.play();
                //}
            }
            else {
                len = 0;
                //if (bears[userName] && bears[userName].animation.isPlaying) {
                //    bears[userName].animation.stop();
                //}
            }

            tx *= len;
            ty *= len;
            len = tx * Math.cos(heading) + ty * Math.sin(heading);
            ty = ty * Math.cos(heading) - tx * Math.sin(heading);
            tx = len;
            vcx = vcx * 0.9 + tx * 0.1;
            vcy = vcy * 0.9 + ty * 0.1;
        }

        pitch = pitch * TRACKING_SCALE + (
                head.getValue("pitch")
                + mouse.getValue("pitch")
                + gamepad.getValue("pitch")) * TRACKING_SCALE_COMP;

        heading = heading * TRACKING_SCALE + (
                head.getValue("heading")
                + touch.getValue("heading")
                + mouse.getValue("heading")
                + gamepad.getValue("heading")) * TRACKING_SCALE_COMP;

        roll = roll * TRACKING_SCALE + head.getValue("roll") * TRACKING_SCALE_COMP;       

        camera.updateProjectionMatrix();
        camera.setRotationFromEuler(new THREE.Euler(0, 0, 0, "XYZ"));
        camera.translateX(vcx * dt);
        camera.translateZ(vcy * dt);
        camera.translateY(vcz * dt);        
        camera.setRotationFromEuler(new THREE.Euler(pitch, heading, roll,  "ZYX"));

        oscope.send("camera.position.x", camera.position.x);
        oscope.send("camera.position.y", camera.position.y);
        oscope.send("camera.position.z", camera.position.z);
        oscope.send("camera.up.x", camera.up.x);
        oscope.send("camera.up.y", camera.up.y);
        oscope.send("camera.up.z", camera.up.z);
        oscope.send("pitch", pitch);
        oscope.send("heading", heading);
        oscope.send("roll", roll);

        //mainScene.Skybox.position.set(camera.position.x, camera.position.y, camera.position.z);
        frame += dt;

        //if (pointer) {
        //    var ph = arm.getValue("heading") + head.getValue("heading") - heading + Math.PI / 2;
        //    var pr = arm.getValue("roll");
        //    var pp = arm.getValue("pitch");
        //    pointer.setRotationFromEuler(new THREE.Euler(0, ph, 0, "YZX"));
        //}

        //x = camera.position.x / 10,
        //y = camera.position.y / 10,
        //z = camera.position.z / 10;

        //var len = Math.sqrt(x * x + y * y + z * z);
        //audio3d.setPosition(x, y, z);
        //audio3d.setVelocity(vcx, vcy, vcz);
        //audio3d.setOrientation(x / len, y / len, z / len, 0, 1, 0);

        //if (userName && frame > dFrame) {
        //    frame -= dFrame;
        //    var state = {
        //        x: camera.position.x,
        //        y: camera.position.y,
        //        z: camera.position.z,
        //        dx: vcx,
        //        dy: vcy,
        //        dz: vcz,
        //        heading: heading,
        //        dheading: (heading - lastHeading) / dFrame,
        //        isRunning: Math.abs(vcx) + Math.abs(vcy) + Math.abs(vcz) > 1
        //    };
        //    lastHeading = heading;
        //    socket.emit("userState", state);
        //}

        //for (var key in bears) {
        //    var bear = bears[key];
        //    bear.setRotationFromEuler(new THREE.Euler(0, 0, 0, "XYZ"));
        //    if (key === userName) {
        //        bear.rotateY(heading);
        //        bear.position.copy(camera.position);
        //        bear.position.y -= PLAYER_HEIGHT;
        //    }
        //    else if (bear.dx || bear.dx || bear.dz) {
        //        bear.position.x += bear.dx * dt;
        //        bear.position.y += bear.dy * dt;
        //        bear.position.z += bear.dz * dt;
        //        bear.heading += bear.dheading * dt;
        //        bear.rotateZ(bear.heading);
        //        bear.nameObj.rotation.z = heading - bear.heading;
        //    }
        //}
    }

    function animate(t) {
        requestAnimationFrame(animate);
        dt = (t - lt) * 0.001;
        lt = t;

        if (camera && heightmap) {
            THREE.AnimationHandler.update(dt);
            head.update(dt);
            arm.update(dt);
            keyboard.update(dt);
            mouse.update(dt);
            gamepad.update(dt);
            touch.update(dt);
            speech.update(dt);
            update(dt);
            draw();
        }
    }

    function draw() {
        if (effect) {
            effect.render(scene, camera);
        }
        else {
            renderer.render(scene, camera);
        }
    }

    function setSize(w, h) {
        if (camera) {
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
        }

        chooseRenderingEffect(getSetting("renderingEffect"));

        renderer.setSize(w, h);
        if (effect) {
            effect.setSize(w, h);
        }
    }

    login = function () {
        if (socket) {
            userName = ctrls.userNameField.value;
            var password = ctrls.passwordField.value;
            if (userName && password) {
                socket.emit("login", {
                    userName: userName,
                    password: password,
                    email: ctrls.emailField.value
                });
            }
            else {
                msg("Please complete the form");
            }
        }
        else {
            msg("No socket available");
        }
    };

    function toggleOptions() {
        var show = ctrls.options.style.display !== "";
        keyboard.pause(show);
        ctrls.options.style.display = (show ? "" : "none");
        if (!show) {
            requestFullScreen();
            mouse.requestPointerLock();
        }
    }

    function chooseRenderingEffect(type) {
        switch (type) {
            case "anaglyph":
                effect = new THREE.AnaglyphEffect(renderer, 5, window.innerWidth, window.innerHeight);
                break;
            case "stereo":
                effect = new THREE.StereoEffect(renderer);
                break;
            case "rift":
                effect = new THREE.OculusRiftEffect(renderer, {
                    worldFactor: 1,
                    HMD: {
                        hResolution: screen.availWidth,
                        vResolution: screen.availHeight,
                        hScreenSize: 0.126,
                        vScreenSize: 0.075,
                        interpupillaryDistance: 0.064,
                        lensSeparationDistance: 0.064,
                        eyeToScreenDistance: 0.051,
                        distortionK: [1, 0.22, 0.06, 0.0],
                        chromaAbParameter: [0.996, -0.004, 1.014, 0.0]
                    }
                });
                break;
            default:
                effect = null;
        }

        setSetting("renderingEffect", type);
    }

    function showChatBox() {
        ctrls.textEntry.style.display = "";
        ctrls.textEntry.focus();
    }

    function readChatBox() {
        ctrls.textEntry.style.display = "none";
        showTyping(true, true, ctrls.textEntry.value);
        ctrls.textEntry.value = "";
    }

    function shutdown() {
        speech.enable(false);
        var state = readForm(ctrls);
        setSetting("formState", state);
    }

    function jump() {
        console.log("jump");
        if (onground) {
            vcz = 10;
            onground = false;
        }
    }

    function fire() {
    }

    function showTyping(isLocal, isComplete, text) {
        if (bears[userName]) {
            if (lastText) {
                bears[userName].remove(lastText);
                lastText = null;
            }

            if (isComplete) {
                socket.emit("chat", text);
            }
            else {
                if (isLocal) {
                    socket.emit("typing", text);
                }
                if (text !== null && text !== undefined) {
                    var textObj = new VUI.Text(
                            text, 0.125,
                            "black", "transparent",
                            0, PLAYER_HEIGHT, -4,
                            "right");
                    lastText = textObj;
                    bears[userName].add(textObj);
                }
            }
        }
    }

    function speechChat() {
        showTyping(true, true, speech.getValue("chat"));
    }

    function shiftLines() {
        for (var i = 0; i < chatLines.length; ++i) {
            chatLines[i].position.z = PLAYER_HEIGHT + (chatLines.length - i) * CHAT_TEXT_SIZE * 1.333;
        }
    }

    function showChat(msg) {
        msg = typeof (msg) === "string" ? msg : fmt("[$1]: $2", msg.userName, msg.text);
        if (bears[userName]) {
            if (userName === msg.userName) {
                showTyping(true, false, null);
            }
            var textObj = new VUI.Text(
                    msg, CHAT_TEXT_SIZE,
                    "black", "transparent",
                    -2, 0, -5, "left");
            bears[userName].add(textObj);
            chatLines.push(textObj);
            shiftLines();
            setTimeout(function () {
                bears[userName].remove(textObj);
                chatLines.shift();
                shiftLines();
            }, 3000);
        }
    }

    function updateUserState(userState) {
        var bear = bears[userState.userName];
        if (bear) {
            bear.setRotationFromEuler(new THREE.Euler(0, 0, 0, "XYZ"));
            bear.dx = ((userState.x + userState.dx * dFrame) - bear.position.x) / dFrame;
            bear.dy = ((userState.y + userState.dz * dFrame) - bear.position.y) / dFrame;
            bear.dz = ((userState.z - PLAYER_HEIGHT + userState.dy * dFrame) - bear.position.z) / dFrame;
            bear.dheading = ((userState.heading + userState.dheading * dFrame) - bear.heading) / dFrame;
            if (!bear.animation.isPlaying && userState.isRunning) {
                bear.animation.play();
            }
            else if (bear.animation.isPlaying && !userState.isRunning) {
                bear.animation.stop();
            }
        }
    }

    function reload() {
        if (isFullScreenMode()) {
            document.location = document.location.href;
        }
        else {
            mouse.requestPointerLock();
            toggleFullScreen();
        }
    }

    function addUser(userState) {
        var bear = bearModel.clone(userState.userName, socket);
        bears[userState.userName] = bear;
        bear.heading = userState.heading;
        updateUserState(userState);
        scene.add(bear);
        bear.nameObj = new VUI.Text(
                userState.userName, 0.5,
                "black", "transparent",
                0, PLAYER_HEIGHT + 2.5, 0,
                "center");
        bear.add(bear.nameObj);


        if (userState.userName === userName && (arm.isEnabled() || arm.isReceiving())) {
            var sphere = new THREE.SphereGeometry(0.5, 4, 2);
            var spine = new THREE.Object3D();
            spine.position.set(0, PLAYER_HEIGHT, 0);
            pointer = new THREE.Mesh(sphere, nameMaterial);
            spine.add(pointer);
            bear.add(spine);
            pointer = spine;
        }
        else {
            msg("user joined: " + userState.userName);
        }
    }

    function userLeft(userName) {
        if (bears[userName]) {
            msg("user disconnected:", userName);
            scene.remove(bears[userName]);
            delete bears[userName];
        }
    }

    function listUsers(users) {
        addUser({
            userName: userName,
            x: camera.position.x,
            y: camera.position.y,
            z: camera.position.z,
            dx: vcx,
            dy: vcy,
            dz: vcz,
            heading: heading,
            dheading: dheading,
            isRunning: !!Math.abs(vcx + vcy + vcz)
        });
        for (var i = 0; i < users.length; ++i) {
            if (users[i].userName !== userName) {
                addUser(users[i]);
            }
        }
        msg("You are now connected to the device server.");
        closers[0].click();
    }

    var closers = document.getElementsByClassName("closeSectionButton");
    for (var i = 0; i < closers.length; ++i) {
        closers[i].addEventListener("click", toggleOptions, false);
    }

    window.addEventListener("keyup", function (evt) {
        if (evt.keyCode === KeyboardInput.GRAVEACCENT) {
            toggleOptions();
        }
    }, false);

    ctrls.menuButton.addEventListener("click", toggleOptions, false);
    ctrls.talkButton.addEventListener("click", showChatBox, false);
    ctrls.textEntry.addEventListener("change", readChatBox, false);
    ctrls.pointerLockButton.addEventListener("click", toggleOptions, false);
    ctrls.fullScreenButton.addEventListener("click", toggleFullScreen, false);
    ctrls.riftRenderButton.addEventListener("click", chooseRenderingEffect.bind(window, "rift"), false);
    ctrls.anaglyphRenderButton.addEventListener("click", chooseRenderingEffect.bind(window, "anaglyph"), false);
    ctrls.stereoRenderButton.addEventListener("click", chooseRenderingEffect.bind(window, "stereo"), false);
    ctrls.regularRenderButton.addEventListener("click", chooseRenderingEffect.bind(window, "regular"), false);

    window.addEventListener("beforeunload", shutdown, false);

    head = new MotionInput("head", null, [
        {name: "heading", axes: [-MotionInput.HEADING]},
        {name: "pitch", axes: [MotionInput.PITCH]},
        {name: "roll", axes: [-MotionInput.ROLL]},
        {name: "jump", axes: [-MotionInput.DACCELX], threshold: 2, repetitions: 2}
    ], socket, oscope);

    arm = new MotionInput("arm", null, [
        {name: "heading", axes: [-MotionInput.HEADING]},
        {name: "pitch", axes: [MotionInput.PITCH]},
        {name: "roll", axes: [-MotionInput.ROLL]}
    ], socket, oscope);

    mouse = new MouseInput("mouse", [
        {axis: MouseInput.DX, scale: 0.4},
        {axis: MouseInput.DY, scale: 0.4},
        {axis: MouseInput.IY, min: -2, max: 1.3}
    ], [
        {name: "heading", axes: [-MouseInput.IX]},
        {name: "pitch", axes: [-MouseInput.IY]},
        {name: "fire", buttons: [1], commandDown: fire, dt: 0.125}
    ], socket, oscope, renderer.domElement);

    touch = new TouchInput("touch", null, null, [
        {name: "heading", axes: [TouchInput.IX0]},
        {name: "drive", axes: [-TouchInput.DY0]}
    ], socket, oscope, renderer.domElement);

    keyboard = new KeyboardInput("keyboard", [
        {name: "strafeLeft", buttons: [-KeyboardInput.A, -KeyboardInput.LEFTARROW]},
        {name: "strafeRight", buttons: [KeyboardInput.D, KeyboardInput.RIGHTARROW]},
        {name: "driveForward", buttons: [-KeyboardInput.W, -KeyboardInput.UPARROW]},
        {name: "driveBack", buttons: [KeyboardInput.S, KeyboardInput.DOWNARROW]},
        {name: "jump", buttons: [KeyboardInput.SPACEBAR], commandDown: jump, dt: 1},
        {name: "fire", buttons: [KeyboardInput.CTRL], commandDown: fire, dt: 0.125},
        {name: "reload", buttons: [KeyboardInput.R], commandDown: reload, dt: 1},
        {name: "chat", preamble: true, buttons: [KeyboardInput.T], commandUp: showTyping.bind(window, true)}
    ], socket, oscope);

    gamepad = new GamepadInput("gamepad", [
        {axis: GamepadInput.LSX, deadzone: 0.1},
        {axis: GamepadInput.LSY, deadzone: 0.1},
        {axis: GamepadInput.RSX, deadzone: 0.1, scale: 1.5},
        {axis: GamepadInput.RSY, deadzone: 0.1, scale: 1.5},
        {axis: GamepadInput.IRSY, min: -2, max: 1.3}
    ], [
        {name: "strafe", axes: [GamepadInput.LSX]},
        {name: "drive", axes: [GamepadInput.LSY]},
        {name: "heading", axes: [-GamepadInput.IRSX]},
        {name: "pitch", axes: [GamepadInput.IRSY]},
        {name: "jump", buttons: [1], commandDown: jump, dt: 0.250},
        {name: "fire", buttons: [2], commandDown: fire, dt: 0.125},
        {name: "options", buttons: [9], commandUp: toggleOptions}
    ], socket, oscope);

    speech = new SpeechInput("speech", [
        {name: "jump", keywords: ["jump"], commandUp: jump},
        {name: "options", keywords: ["options"], commandUp: toggleOptions},
        {name: "chat", preamble: true, keywords: ["message"], commandUp: speechChat}
    ], socket, oscope);

    gamepad.addEventListener("gamepadconnected", function (id) {
        if (!gamepad.isGamepadSet() && ask(fmt("Would you like to use this gamepad? \"$1\"", id), true)) {
            gamepad.setGamepad(id);
        }
    }, false);

    window.addEventListener("resize", function () {
        setSize(window.innerWidth, window.innerHeight);
    }, false);

    function setupModuleEvents(module, name) {
        var e = ctrls[name + "Enable"],
            t = ctrls[name + "Transmit"],
            r = ctrls[name + "Receive"];
        z = ctrls[name + "Zero"];
        e.addEventListener("change", function () {
            module.enable(e.checked);
            t.disabled = !e.checked;
            if (t.checked && t.disabled) {
                t.checked = false;
            }
        });
        t.addEventListener("change", function () {
            module.transmit(t.checked);
        });
        r.addEventListener("change", function () {
            module.receive(r.checked);
        });

        if (z) {
            z.addEventListener("click", module.zeroAxes.bind(module), false);
        }

        module.enable(e.checked);
        module.transmit(t.checked);
        module.receive(r.checked);
        t.disabled = !e.checked;
        if (t.checked && t.disabled) {
            t.checked = false;
        }
    }

    setupModuleEvents(head, "head");
    setupModuleEvents(arm, "arm");
    setupModuleEvents(mouse, "mouse");
    setupModuleEvents(touch, "touch");
    setupModuleEvents(keyboard, "keyboard");
    setupModuleEvents(gamepad, "gamepad");
    setupModuleEvents(speech, "speech");

    var mainScene = new ModelLoader("models/scene.js", progress, function (objects) {
        scene = objects.scene;
        camera = new THREE.PerspectiveCamera(
            mainScene.Camera.fov, 
            mainScene.Camera.aspect, 
            mainScene.Camera.near, 
            drawDistance);
        camera.up.set(0, 0, 1);
        heightmap = mainScene.makeHeightMap(mainScene.Terrain, CLUSTER);
        var v = 0.55 * drawDistance;
        mainScene.Skybox.scale.set(v, v, v);
        scene.fog = new THREE.Fog(BG_COLOR, 1, drawDistance * 0.6);
        audio3d.loadSound3D(
            "music/ocean.mp3", true,
            mainScene.Campfire.position.x,
            mainScene.Campfire.position.y,
            mainScene.Campfire.position.z,
            progress,
            function (snd) {
                oceanSound = snd;
                snd.source.start(0);
            }
        );
    });

    var bearModel = new ModelLoader("models/bear.dae", progress);

    audio3d.loadSoundFixed("music/game1.ogg.break", true, progress, function (snd) {
        snd.volume.gain.value = 0.5;
        snd.source.start(0);
    });

    document.body.insertBefore(renderer.domElement, document.body.firstChild);
    renderer.domElement.setAttribute("tabindex", 0);
    setSize(window.innerWidth, window.innerHeight);

    requestAnimationFrame(animate);
}
