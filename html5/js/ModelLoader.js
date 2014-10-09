var _COLLADA = new THREE.ColladaLoader();
_COLLADA.options.convertUpAxis = true;
var _JSON = new THREE.JSONLoader(true);
var _SCENE = new THREE.SceneLoader();
function ModelLoader(src, progress, success) {
    if (/\.dae$/.test(src)) {
        this.type = "COLLADA";
        ModelLoader.loadCollada(src, progress, function (object) {
            this.template = object;
            object.traverse(function (child) {
                if (child.name) {
                    this[child.name] = child;
                }
            }.bind(this));
            if (success) {
                success(object);
            }
        }.bind(this));
    }
    else if (/\.js$/.test(src)) {
        this.type = "JSON";
        ModelLoader.loadScene(src, progress, function (objects) {
            this.template = objects;
            var traverseList = ["cameras", "lights", "objects"];
            for(var i = 0; i < traverseList.length; ++i){
                var obj = traverseList[i];
                var collection = objects[obj];
                for(key in collection){
                    if(!this[key]){
                        this[key] = collection[key];
                    }
                    else{
                        console.log(collection[key]);
                    }
                }
            }
            if (success) {
                success(objects);
            }
        }.bind(this));
    }
}

ModelLoader.loadCollada = function (src, progress, success) {
    progress("loading", src);
    _COLLADA.load(src, function (collada) {
        if (success) {
            success(collada.scene);
        }
        progress("success", src);
    }, function (prog) {
        progress("intermediate", src, prog.loaded);
    });
};

ModelLoader.loadJSON = function (src, progress, success) {
    progress("loading", src);
    _JSON.loadAjaxJSON(
        src,
        success,
        "models/",
        function (prog) {
            progress("intermediate", src, prog.loaded);
        }
    );
};

ModelLoader.loadScene = function (src, progress, success) {
    progress("loading", src);
    _SCENE.load(
        src,
        function(objects){
            success(objects);
            progress("success", src);
        },
        function (prog) {
            progress("intermediate", src, prog.loaded);
        },
        function (err){
            progress("error", src, err);
        }
    );
};

ModelLoader.__makeHeightMap = function (obj, CLUSTER, axisA, axisB) {
    var minAxisA = "min" + axisA.toUpperCase();
    var heightmap = [];
    var verts = obj.geometry.vertices;
    heightmap.minX = 0;
    heightmap[minAxisA] = 0;
    for (var i = 0; i < verts.length; ++i) {
        heightmap.minX = Math.min(heightmap.minX, verts[i].x);
        heightmap[minAxisA] = Math.min(heightmap[minAxisA], verts[i][axisA]);
    }
    
    for (var i = 0; i < verts.length; ++i) {
        var x = Math.round((verts[i].x - heightmap.minX) / CLUSTER);
        var z = Math.round((verts[i][axisA] - heightmap[minAxisA]) / CLUSTER);
        if(!heightmap[z]){
            heightmap[z] = [];
        }
        if(heightmap[z][x] === undefined){
            heightmap[z][x] = verts[i][axisB];
        }
        else{
            heightmap[z][x] = Math.max(heightmap[z][x], verts[i][axisB]);
        }
    }
    return heightmap;
};

ModelLoader.prototype.makeHeightMap = function(obj, CLUSTER){
    if(this.type === "COLLADA"){
        return ModelLoader.__makeHeightMap(obj.children[0], CLUSTER, "z", "y");        
    }
    else if(this.type === "JSON"){
        return ModelLoader.__makeHeightMap(obj, CLUSTER, "y", "z");
    }
}

ModelLoader.prototype.clone = function (socket) {
    var obj = this.template.clone();
    this.socket = socket;

    obj.traverse(function (child) {
        if (child instanceof THREE.SkinnedMesh) {
            obj.mesh = child;
            obj.animation = new THREE.Animation(child, child.geometry.animation);
            if (!this.template.originalAnimationData && obj.animation.data) {
                this.template.originalAnimationData = obj.animation.data;
            }
            if (!obj.animation.data) {
                obj.animation.data = this.template.originalAnimationData;
            }
        }
    }.bind(this));

    return obj;
};