var Editor = Class({
    initialize: function (parent, list) {
        EDITOR_SIZE = { x: 1920, y: 960 };
        CANVAS_SIZE = { x: 192, y: 96 };
        CANVAS_PIXEL_SCALE = 3;
        BOUNDING_BOX_RAW = {
            size: 253,
            maxNegVal: -127,
            maxPosVal: 126
        };
        BOUNDING_BOX = {
            size: CANVAS_PIXEL_SCALE * BOUNDING_BOX_RAW.size,
            maxNegVal: CANVAS_PIXEL_SCALE * BOUNDING_BOX_RAW.maxNegVal,
            maxPosVal: CANVAS_PIXEL_SCALE * BOUNDING_BOX_RAW.maxPosVal
        };
        MAX_SYMBOL_SIDE_LEN = CANVAS_PIXEL_SCALE * 191;
        MAX_NUM_LAYERS = 225;
        this.zoom = window.innerWidth / (0.5 * EDITOR_SIZE.x);
        if (isMobile) {
            this.ZOOM_STEP = this.zoom;
        }
        else {
            this.ZOOM_STEP = this.zoom / 8;
        }
        this.ZOOM_MIN = this.zoom / 4;
        this.ZOOM_MAX = this.zoom * 4;
        this.MIN_VTX_VARIATION = 2 * CANVAS_PIXEL_SCALE;
        this.LAYER_HIGHLIGHT_FACTOR = 10.0;
        // Setting option for enabling assistance in doing purely vertical/horizontal changes in symbol
        this.disableSmallVtxChange = false;
        this.highlightedLayers = null;

        this.list = list;
        this.mainGroup = list.mainGroup;

        //Create the renderer
        this.renderer = PIXI.autoDetectRenderer(EDITOR_SIZE.x, EDITOR_SIZE.y, {
            transparent: true,
            preserveDrawingBuffer: true
        });

        //Create a container object called the `this.stage`
        this.stage = new PIXI.Container();
        let editorFilter = new PIXI.Filter(null, `
            precision mediump float;
            varying vec2 vTextureCoord;
            uniform sampler2D uSampler;
            // Brightness-Saturation-Contrast Filter
            vec3 applyBSC(vec4 color, float brightness, float saturation, float contrast)
            {
	            vec3 color_B  = color.rgb * (1.0 +color.a * (brightness -1.0));
	            vec3 intensity = vec3(dot(color_B, vec3(0.2125, 0.7154, 0.0721)));
	            vec3 color_BS  = mix(intensity, color_B, 1.0 + color.a * (saturation -1.0));
	            vec3 color_BSC  = mix(vec3(0.5, 0.5, 0.5), color_BS, 1.0 + color.a * (contrast - 1.0));
	            return color_BSC;
            }
            void main(void)
            {
                float x = vTextureCoord.x;
                float y = vTextureCoord.y;
                vec4 pixel = texture2D(uSampler, vTextureCoord.xy);
                if (x < 0.285 || x > 0.655 || y < 0.102 || y > 0.842) {
                    gl_FragColor = pixel;
                }
                else {
	                vec3 color = applyBSC(pixel, 0.7, 0.9, 2.12);
	                gl_FragColor = vec4(color, pixel.a);
                }
            }`
            );
        this.stage.filters = [editorFilter];
        this.layers = [];
        this.parts = [];

        this.selectedLayer = null;

        for (var i in partsInfo.dataArray) {
            this.parts[i] = new PIXI.Texture(new PIXI.BaseTexture(LoadedImageFiles[partsInfo.dataArray[i] + partsInfo.imgType]));
        }

        this.overlayImg = new OverlayImage();
        this.stage.addChild(this.overlayImg.getImage());

        this.SABox = new PIXI.mesh.NineSlicePlane(new PIXI.Texture(new PIXI.BaseTexture(LoadedImageFiles["SABoxSprite.png"])), 2, 2, 2, 2);
        this.SABox.height = 960;
        this.SABox.width = 1920;
        this.stage.addChild(this.SABox);

        // Buttons
        this.currBtnDown = -1;
        var tl = $('<i class="fa fa-arrow-up fa-border edit-button corner-arrow no-highlight no-panning" ondragstart="return false;">');
        tl[0].list = list;
        tl[0].editor = this;
        tl.on('vmousedown', function () {
            if (!panZoomActive) {
                this.editor.currBtnDown = 0;
                if (!this.editor.disableSmallVtxChange)
                    this.editor.origEditbtn = {
                        vtces: this.editor.layerCtrl.activeLayer.vertices.slice(0),
                        x: this.editor.layerCtrl.activeLayer.x,
                        y: this.editor.layerCtrl.activeLayer.y
                    };
            }
        }).on('vmousemove', function () {
        }).on('vmouseup', function (e) {
            e.stopPropagation();
            $('canvas').trigger('vmouseup');
        }).hide();
        var tr = $('<i class="fa fa-arrow-right fa-border edit-button corner-arrow no-highlight no-panning" ondragstart="return false;">');
        tr[0].list = list;
        tr[0].editor = this;
        tr.on('vmousedown', function () {
            if (!panZoomActive) {
                this.editor.currBtnDown = 1;
                if (!this.editor.disableSmallVtxChange)
                    this.editor.origEditbtn = {
                        vtces: this.editor.layerCtrl.activeLayer.vertices.slice(0),
                        x: this.editor.layerCtrl.activeLayer.x,
                        y: this.editor.layerCtrl.activeLayer.y
                    };
            }
        }).on('vmousemove', function () {
        }).on('vmouseup', function (e) {
            e.stopPropagation();
            $('canvas').trigger('vmouseup');
        }).hide();
        var br = $('<i class="fa fa-arrow-down fa-border edit-button corner-arrow no-highlight no-panning" ondragstart="return false;">');
        br[0].list = list;
        br[0].editor = this;
        br.on('vmousedown', function () {
            if (!panZoomActive) {
                this.editor.currBtnDown = 2;
                if (!this.editor.disableSmallVtxChange)
                    this.editor.origEditbtn = {
                        vtces: this.editor.layerCtrl.activeLayer.vertices.slice(0),
                        x: this.editor.layerCtrl.activeLayer.x,
                        y: this.editor.layerCtrl.activeLayer.y
                    };
            }
        }).on('vmousemove', function () {
        }).on('vmouseup', function (e) {
            e.stopPropagation();
            $('canvas').trigger('vmouseup');
        }).hide();
        var bl = $('<i class="fa fa-arrow-left fa-border edit-button corner-arrow no-highlight no-panning" ondragstart="return false;">');
        bl[0].list = list;
        bl[0].editor = this;
        bl.on('vmousedown', function () {
            if (!panZoomActive) {
                this.editor.currBtnDown = 3;
                if (!this.editor.disableSmallVtxChange)
                    this.editor.origEditbtn = {
                        vtces: this.editor.layerCtrl.activeLayer.vertices.slice(0),
                        x: this.editor.layerCtrl.activeLayer.x,
                        y: this.editor.layerCtrl.activeLayer.y
                    };
            }
        }).on('vmousemove', function () {
        }).on('vmouseup', function (e) {
            e.stopPropagation();
            $('canvas').trigger('vmouseup');
        }).hide();
        var btn_l = $('<i class="fa fa-arrow-left fa-border edit-button no-highlight no-panning" ondragstart="return false;">');
        btn_l[0].list = list;
        btn_l[0].editor = this;
        btn_l.on('vmousedown', function (e) {
            if (!panZoomActive) {
                this.editor.currBtnDown = 4;
                if (!this.editor.disableSmallVtxChange)
                    this.editor.origEditbtn = {
                        vtces: this.editor.layerCtrl.activeLayer.vertices.slice(0),
                        x: this.editor.layerCtrl.activeLayer.x,
                        y: this.editor.layerCtrl.activeLayer.y
                    };
            }
        }).on('vmousemove', function () {
        }).on('vmouseup', function (e) {
            e.stopPropagation();
            $('canvas').trigger('vmouseup');
        }).hide();
        var btn_u = $('<i class="fa fa-arrow-up fa-border edit-button no-highlight no-panning" ondragstart="return false;">');
        btn_u[0].list = list;
        btn_u[0].editor = this;
        btn_u.on('vmousedown', function (e) {
            if (!panZoomActive) {
                this.editor.currBtnDown = 5;
                if (!this.editor.disableSmallVtxChange)
                    this.editor.origEditbtn = {
                        vtces: this.editor.layerCtrl.activeLayer.vertices.slice(0),
                        x: this.editor.layerCtrl.activeLayer.x,
                        y: this.editor.layerCtrl.activeLayer.y
                    };
            }
        }).on('vmousemove', function () {
        }).on('vmouseup', function (e) {
            e.stopPropagation();
            $('canvas').trigger('vmouseup');
        }).hide();
        var btn_r = $('<i class="fa fa-arrow-right fa-border edit-button no-highlight no-panning" ondragstart="return false;">');
        btn_r[0].list = list;
        btn_r[0].editor = this;
        btn_r.on('vmousedown', function (e) {
            if (!panZoomActive) {
                this.editor.currBtnDown = 6;
                if (!this.editor.disableSmallVtxChange)
                    this.editor.origEditbtn = {
                        vtces: this.editor.layerCtrl.activeLayer.vertices.slice(0),
                        x: this.editor.layerCtrl.activeLayer.x,
                        y: this.editor.layerCtrl.activeLayer.y
                    };
            }
        }).on('vmousemove', function () {
        }).on('vmouseup', function (e) {
            e.stopPropagation();
            $('canvas').trigger('vmouseup');
        }).hide();
        var btn_d = $('<i class="fa fa-arrow-down fa-border edit-button no-highlight no-panning" ondragstart="false">');
        btn_d[0].list = list;
        btn_d[0].editor = this;
        btn_d.on('vmousedown', function (e) {
            if (!panZoomActive) {
                this.editor.currBtnDown = 7;
                if (!this.editor.disableSmallVtxChange)
                    this.editor.origEditbtn = {
                        vtces: this.editor.layerCtrl.activeLayer.vertices.slice(0),
                        x: this.editor.layerCtrl.activeLayer.x,
                        y: this.editor.layerCtrl.activeLayer.y
                    };
            }
        }).on('vmousemove', function () {
        }).on('vmouseup', function (e) {
            e.stopPropagation();
            $('canvas').trigger('vmouseup');
        }).hide();
        var btn_rot = $('<i class="fa fa-repeat fa-border edit-button no-highlight no-panning" ondragstart="return false;">');
        btn_rot[0].list = list;
        btn_rot[0].editor = this;
        btn_rot.on('vmousedown', function (e) {
            if (!panZoomActive) {
                this.editor.currBtnDown = 8;
                if (!this.editor.disableSmallVtxChange)
                    this.editor.origEditbtn = {
                        vtces: this.editor.layerCtrl.activeLayer.vertices.slice(0),
                        x: this.editor.layerCtrl.activeLayer.x,
                        y: this.editor.layerCtrl.activeLayer.y
                    };
            }
        }).on('vmousemove', function () {
        }).on('vmouseup', function (e) {
            e.stopPropagation();
            $('canvas').trigger('vmouseup');
        }).hide();
        var btn_resize = $('<i class="fa fa-expand fa-border edit-button no-highlight no-panning" ondragstart="return false;">');
        btn_resize[0].list = list;
        btn_resize[0].editor = this;
        btn_resize.on('vmousedown', function (e) {
            if (!panZoomActive) {
                this.editor.currBtnDown = 9;
                if (!this.editor.disableSmallVtxChange)
                    this.editor.origEditbtn = {
                        vtces: this.editor.layerCtrl.activeLayer.vertices.slice(0),
                        x: this.editor.layerCtrl.activeLayer.x,
                        y: this.editor.layerCtrl.activeLayer.y
                    };
            }
        }).on('vmousemove', function () {
        }).on('vmouseup', function (e) {
            e.stopPropagation();
            $('canvas').trigger('vmouseup');
        }).hide();
        var btn_resizeX = $('<i class="fa fa-arrows-h fa-border edit-button no-highlight no-panning" ondragstart="return false;">');
        btn_resizeX[0].list = list;
        btn_resizeX[0].editor = this;
        btn_resizeX.on('vmousedown', function (e) {
            if (!panZoomActive) {
                this.editor.currBtnDown = 10;
                if (!this.editor.disableSmallVtxChange)
                    this.editor.origEditbtn = {
                        vtces: this.editor.layerCtrl.activeLayer.vertices.slice(0),
                        x: this.editor.layerCtrl.activeLayer.x,
                        y: this.editor.layerCtrl.activeLayer.y
                    };
            }
        }).on('vmousemove', function () {
        }).on('vmouseup', function (e) {
            e.stopPropagation();
            $('canvas').trigger('vmouseup');
        }).hide();
        var btn_resizeY = $('<i class="fa fa-arrows-v fa-border edit-button no-highlight no-panning" ondragstart="return false;">');
        btn_resizeY[0].list = list;
        btn_resizeY[0].editor = this;
        btn_resizeY.on('vmousedown', function (e) {
            if (!panZoomActive) {
                this.editor.currBtnDown = 11;
                if (!this.editor.disableSmallVtxChange)
                    this.editor.origEditbtn = {
                        vtces: this.editor.layerCtrl.activeLayer.vertices.slice(0),
                        x: this.editor.layerCtrl.activeLayer.x,
                        y: this.editor.layerCtrl.activeLayer.y
                    };
            }
        }).on('vmousemove', function () {
        }).on('vmouseup', function (e) {
            e.stopPropagation();
            $('canvas').trigger('vmouseup');
        }).hide();
        function diagStretch(index, clientPos, origValues) {
            var canvas = $('canvas');
            var canvasPos = canvas.offset();
            var editor = canvas[0].editor;
            var relPos = { left: clientPos.left - canvasPos.left, top: clientPos.top - canvasPos.top };
            var layer = list.selectedElem.parentNode.elem;
            // Get indices of vertices in the diagonal (0 and 6) or (2 and 4)
            var thisVerIndex = 2 * index, oppositeVerIndex = 6 - 2 * index;
            // Get displacement from mousemove
            var dPos = {
                x: roundPosition((relPos.left / editor.zoom) - layer.x - layer.vertices[thisVerIndex]),
                y: roundPosition((relPos.top / editor.zoom) - layer.y - layer.vertices[thisVerIndex + 1])
            }
            /**
             * Check if symbol will not trespass editor boundaries 
             */
            var relX = (layer.x - (EDITOR_SIZE.x / 2)),
                relY = (layer.y - (EDITOR_SIZE.y / 2));
            let minVX = Math.min(layer.vertices[0], layer.vertices[2], layer.vertices[4], layer.vertices[6]),
                minVY = Math.min(layer.vertices[1], layer.vertices[3], layer.vertices[5], layer.vertices[7]),
                maxVX = Math.max(layer.vertices[0], layer.vertices[2], layer.vertices[4], layer.vertices[6]),
                maxVY = Math.max(layer.vertices[1], layer.vertices[3], layer.vertices[5], layer.vertices[7]);
            let halfW = Math.abs(maxVX - minVX) / 2, halfH = Math.abs(maxVY - minVY) / 2;
            // Checking X-axis boundary
            let minLeeway = Math.min(
                Math.abs(BOUNDING_BOX.maxPosVal - relX - halfW),
                Math.abs(BOUNDING_BOX.maxNegVal - relX + halfW));
            if (layer.vertices[thisVerIndex] + dPos.x >= 0 && dPos.x > minLeeway)
                dPos.x = roundPosition(minLeeway);
            if (layer.vertices[thisVerIndex] + dPos.x < 0 && dPos.x < -minLeeway)
                dPos.x = -roundPosition(minLeeway);
            // Checking Y-axis boundary
            minLeeway = Math.min(
                Math.abs(BOUNDING_BOX.maxPosVal - relY - halfH),
                Math.abs(BOUNDING_BOX.maxNegVal - relY + halfH));
            if (layer.vertices[thisVerIndex + 1] + dPos.y >= 0 && dPos.y > minLeeway)
                dPos.y = roundPosition(minLeeway);
            if (layer.vertices[thisVerIndex + 1] + dPos.y < 0 && dPos.y < -minLeeway)
                dPos.y = -roundPosition(minLeeway);
            /**
             * Check if symbol will have a valid size
             */
            let maxlen = MAX_SYMBOL_SIDE_LEN;
            let testlen1x = Math.abs(layer.vertices[0] - layer.vertices[2]),
                testlen1y = Math.abs(layer.vertices[1] - layer.vertices[3]),
                testlen2x = Math.abs(layer.vertices[0] - layer.vertices[4]),
                testlen2y = Math.abs(layer.vertices[1] - layer.vertices[5]);
            let maxDPosX = (maxlen - Math.max(testlen1x, testlen2x)) / 2;
            if (layer.vertices[thisVerIndex] + dPos.x >= 0 && dPos.x > maxDPosX)
                dPos.x = roundPosition(maxDPosX);
            if (layer.vertices[thisVerIndex] + dPos.x < 0 && dPos.x < -maxDPosX)
                dPos.x = -roundPosition(maxDPosX);
            let maxDPosY = (maxlen - Math.max(testlen1y, testlen2y)) / 2;
            if (layer.vertices[thisVerIndex + 1] + dPos.y >= 0 && dPos.y > maxDPosY)
                dPos.y = roundPosition(maxDPosY);
            if (layer.vertices[thisVerIndex + 1] + dPos.y < 0 && dPos.y < -maxDPosY)
                dPos.y = -roundPosition(maxDPosY);
            /**
             * Perform the vertex change
             */
            // Change X
            layer.vertices[thisVerIndex] += dPos.x;
            layer.vertices[oppositeVerIndex] -= dPos.x;
            // Change Y
            layer.vertices[thisVerIndex + 1] += dPos.y;
            layer.vertices[oppositeVerIndex + 1] -= dPos.y;
            if (!editor.disableSmallVtxChange) {
                if (Math.abs(layer.vertices[thisVerIndex] - origValues.vtces[thisVerIndex])
                    < editor.MIN_VTX_VARIATION) {
                    layer.vertices[thisVerIndex] = origValues.vtces[thisVerIndex];
                    layer.vertices[oppositeVerIndex] = origValues.vtces[oppositeVerIndex];
                }
                if (Math.abs(layer.vertices[thisVerIndex + 1] - origValues.vtces[thisVerIndex + 1])
                    < editor.MIN_VTX_VARIATION) {
                    layer.vertices[thisVerIndex + 1] = origValues.vtces[thisVerIndex + 1];
                    layer.vertices[oppositeVerIndex + 1] = origValues.vtces[oppositeVerIndex + 1];
                }
            }

            editor.updateLayer(layer);
            editor.render();
        }
        function sideStretch(index, clientPos, origValues) {
            var corner1Index, corner2Index, vi3, vi4;
            var isHorizontal;
            switch (index) { // Get index for vertices that compose quad side picked
                case 0: corner1Index = 0; corner2Index = 4; vi3 = 2; vi4 = 6; break; // left
                case 1: corner1Index = 0; corner2Index = 2; vi3 = 4; vi4 = 6; break; // up
                case 2: corner1Index = 2; corner2Index = 6; vi3 = 0; vi4 = 4; break; // right
                case 3: corner1Index = 4; corner2Index = 6; vi3 = 0; vi4 = 2; break; // down
                default:
                    return;
            }
            var canvas = $('canvas');
            var canvasPos = canvas.offset();
            var editor = canvas[0].editor;
            var layer = list.selectedElem.parentNode.elem;
            // Get displacement from mousemove
            var relPos = { left: clientPos.left - canvasPos.left, top: clientPos.top - canvasPos.top };
            var dPos = {
                x: roundPosition(((relPos.left / editor.zoom) - layer.x
                    - ((layer.vertices[corner1Index] + layer.vertices[corner2Index]) / 2))) / 2,
                y: roundPosition(((relPos.top / editor.zoom) - layer.y
                    - ((layer.vertices[corner1Index + 1] + layer.vertices[corner2Index + 1]) / 2))) / 2
            };
            /**
             * Check if symbol will have a valid size
             */
            let maxlen = MAX_SYMBOL_SIDE_LEN;
            // Checking X
            // Get directional length and compute max displacement possible
            let dirLen = layer.vertices[corner1Index] - layer.vertices[vi3];
            let maxDPosX = (maxlen - Math.abs(dirLen)) / 2;
            // Truncate displacement when necessary
            if (dirLen >= 0 && dPos.x > maxDPosX)
                dPos.x = roundPosition(maxDPosX);
            else if (dirLen < 0 && dPos.x < -maxDPosX)
                dPos.x = -roundPosition(maxDPosX);
            // Checking Y
            // Get directional length and compute max displacement possible
            dirLen = layer.vertices[corner1Index + 1] - layer.vertices[vi3 + 1];
            let maxDPosY = (maxlen - Math.abs(dirLen)) / 2;
            // Truncate displacement when necessary
            if (dirLen >= 0 && dPos.y > maxDPosY)
                dPos.y = roundPosition(maxDPosY);
            else if (dirLen < 0 && dPos.y < -maxDPosY)
                dPos.y = -roundPosition(maxDPosY);
            /**
             * Check if symbol will not trespass editor boundaries
             */
            // Check if trespasses in x-axis
            maxDPosX = ((BOUNDING_BOX.maxPosVal)
                - layer.x + (EDITOR_SIZE.x / 2) - Math.max(
                    layer.vertices[corner1Index],
                    layer.vertices[corner2Index])) / 2;
            if (maxDPosX < 0) maxDPosX = 0;
            let minDPosX = ((BOUNDING_BOX.maxNegVal)
                - layer.x + (EDITOR_SIZE.x / 2) - Math.min(
                    layer.vertices[corner1Index],
                    layer.vertices[corner2Index])) / 2;
            if (minDPosX > 0) minDPosX = 0;
            if (dPos.x > maxDPosX)
                dPos.x = roundPosition(maxDPosX);
            else if (dPos.x < minDPosX)
                dPos.x = roundPosition(minDPosX);
            // Check if respasses in y-axis
            maxDPosY = ((BOUNDING_BOX.maxPosVal)
                - layer.y + (EDITOR_SIZE.y / 2) - Math.max(
                    layer.vertices[corner1Index + 1],
                    layer.vertices[corner2Index + 1])) / 2;
            if (maxDPosY < 0) maxDPosY = 0;
            let minDPosY = ((BOUNDING_BOX.maxNegVal)
                - layer.y + (EDITOR_SIZE.y / 2) - Math.min(
                    layer.vertices[corner1Index + 1],
                    layer.vertices[corner2Index + 1])) / 2;
            if (minDPosY > 0) minDPosY = 0;
            if (dPos.y > maxDPosY)
                dPos.y = roundPosition(maxDPosY);
            else if (dPos.y < minDPosY)
                dPos.y = roundPosition(minDPosY);
            /**
             * Perform the vertex change
             */
            // Change X
            layer.x += dPos.x;
            layer.vertices[corner1Index] += dPos.x;
            layer.vertices[corner2Index] += dPos.x;
            layer.vertices[vi3] -= dPos.x;
            layer.vertices[vi4] -= dPos.x;
            // Change Y
            layer.y += dPos.y;
            layer.vertices[corner1Index + 1] += dPos.y;
            layer.vertices[corner2Index + 1] += dPos.y;
            layer.vertices[vi3 + 1] -= dPos.y;
            layer.vertices[vi4 + 1] -= dPos.y;
            // Keep original x and/or y position if change is too small
            if (!editor.disableSmallVtxChange) {
                if (Math.abs((layer.vertices[corner1Index] + layer.x) 
                    - (origValues.vtces[corner1Index] + origValues.x)) 
                    < editor.MIN_VTX_VARIATION) {

                    layer.x = origValues.x;
                    layer.vertices[corner1Index] = origValues.vtces[corner1Index];
                    layer.vertices[corner2Index] = origValues.vtces[corner2Index];
                    layer.vertices[vi3] = origValues.vtces[vi3];
                    layer.vertices[vi4] = origValues.vtces[vi4];
                }
                if (Math.abs((layer.vertices[corner1Index + 1] + layer.y)
                    - (origValues.vtces[corner1Index + 1] + origValues.y))
                    < editor.MIN_VTX_VARIATION) {

                    layer.y = origValues.y;
                    layer.vertices[corner1Index + 1] = origValues.vtces[corner1Index + 1];
                    layer.vertices[corner2Index + 1] = origValues.vtces[corner2Index + 1];
                    layer.vertices[vi3 + 1] = origValues.vtces[vi3 + 1];
                    layer.vertices[vi4 + 1] = origValues.vtces[vi4 + 1];
                }
            }

            editor.updateLayer(layer);
            editor.render();
        }
        function rotate(clientPos, origValues) {
            var canvas = $('canvas');
            var canvasPos = canvas.offset();
            var editor = canvas[0].editor;
            var layer = list.selectedElem.parentNode.elem;

            var relPos = { left: clientPos.left - canvasPos.left, top: clientPos.top - canvasPos.top };
            var dPos = {
                x: ((relPos.left / editor.zoom) - layer.x),
                y: ((relPos.top / editor.zoom) - layer.y)
            };
            var ang = Math.asin(dPos.x / Math.sqrt((dPos.x * dPos.x) + (dPos.y * dPos.y)));
            var v = origValues.vtces;
            if (dPos.y > 0) ang = Math.PI - ang;
            var sin = Math.sin(ang), cos = Math.cos(ang);
            let boundingBoxMin = BOUNDING_BOX.maxNegVal,
                boundingBoxMax = BOUNDING_BOX.maxPosVal,
                relLayerX = layer.x - EDITOR_SIZE.x / 2,
                relLayerY = layer.y - EDITOR_SIZE.y / 2;
            var newV = [];
            for (var i = 0; i < v.length; i += 2) {
                newV[i] = roundPosition(cos * v[i] - sin * v[i + 1]);
                newV[i + 1] = roundPosition(sin * v[i] + cos * v[i + 1]);
                /**
                 * Check if rotation will cause symbol to trespass bounding box
                 */
                let testX = (relLayerX + newV[i]),
                    testY = (relLayerY + newV[i + 1])
                if (testX < boundingBoxMin || testX > boundingBoxMax
                    || testY < boundingBoxMin || testY > boundingBoxMax) {
                    return; // Do not rotate if it will trespass
                }
            }
            /**
             * Perform vertex rotation
             */
            let ctrlFactorX = 0, ctrlFactorY = 0;
            if (Math.abs(layer.x) % 3 == 1.5) ctrlFactorX = 1.5;
            if (Math.abs(layer.y) % 3 == 1.5) ctrlFactorY = 1.5;
            for (var i = 0; i < v.length; i++) {
                layer.vertices[i] = newV[i];
            }
            if (ctrlFactorX == 1.5) {
                if (layer.vertices[0] >= 0) {
                    layer.vertices[0] += ctrlFactorX;
                    layer.vertices[6] -= ctrlFactorX;
                }
                else {
                    layer.vertices[0] -= ctrlFactorX;
                    layer.vertices[6] += ctrlFactorX;
                }
                if (layer.vertices[2] >= 0) {
                    layer.vertices[2] += ctrlFactorX;
                    layer.vertices[4] -= ctrlFactorX;
                }
                else {
                    layer.vertices[2] -= ctrlFactorX;
                    layer.vertices[4] += ctrlFactorX;
                }
            }
            if (ctrlFactorY == 1.5) {
                if (layer.vertices[1] >= 0) {
                    layer.vertices[1] += ctrlFactorY;
                    layer.vertices[7] -= ctrlFactorY;
                }
                else {
                    layer.vertices[1] -= ctrlFactorY;
                    layer.vertices[7] += ctrlFactorY;
                }
                if (layer.vertices[3] >= 0) {
                    layer.vertices[3] += ctrlFactorY;
                    layer.vertices[5] -= ctrlFactorY;
                }
                else {
                    layer.vertices[3] -= ctrlFactorY;
                    layer.vertices[5] += ctrlFactorY;
                }
            }
            editor.updateLayer(layer);
            editor.render();
        }
        function resizeSymbol(clientPos, origValues) {
            let canvas = $('canvas');
            let canvasPos = canvas.offset();
            let editor = canvas[0].editor;
            let layer = list.selectedElem.parentNode.elem;
            let origVtces = origValues.vtces;
            let currVtces = layer.vertices;
            // Get scaling factor from mousemove displacement (based on X-coord)
            let relPos = { left: clientPos.left - canvasPos.left, top: clientPos.top - canvasPos.top };
            let dPosX = ((relPos.left / editor.zoom) - layer.x);
            let scalingFactor = (1 + dPosX / 100);
            if (scalingFactor < 0.1) scalingFactor = 0.1;
            /**
             * Check if symbol will have a valid size
             */
            let maxlen = MAX_SYMBOL_SIDE_LEN;
            let testlen1x = Math.abs(origVtces[0] - origVtces[2]),
                testlen1y = Math.abs(origVtces[1] - origVtces[3]),
                testlen2x = Math.abs(origVtces[0] - origVtces[4]),
                testlen2y = Math.abs(origVtces[1] - origVtces[5]);
            let maxside = Math.max(testlen1x, testlen1y, testlen2x, testlen2y);
            let maxScalingFactor = maxlen / maxside;
            if (scalingFactor > maxScalingFactor) scalingFactor = maxScalingFactor;
            /**
             * Check if symbol will not trespass editor boundaries
             */
            var relX = (layer.x - (EDITOR_SIZE.x / 2)),
                relY = (layer.y - (EDITOR_SIZE.y / 2));
            let minVX = Math.min(origVtces[0], origVtces[2], origVtces[4], origVtces[6]),
                minVY = Math.min(origVtces[1], origVtces[3], origVtces[5], origVtces[7]),
                maxVX = Math.max(origVtces[0], origVtces[2], origVtces[4], origVtces[6]),
                maxVY = Math.max(origVtces[1], origVtces[3], origVtces[5], origVtces[7]);
            let halfW = Math.abs(maxVX - minVX) / 2, halfH = Math.abs(maxVY - minVY) / 2;
            // Checking X-axis boundary
            let minLeeway = Math.min(
                Math.abs(BOUNDING_BOX.maxPosVal - relX - halfW),
                Math.abs(BOUNDING_BOX.maxNegVal - relX + halfW));
            maxScalingFactor = 1 + minLeeway / halfW;
            if (scalingFactor > maxScalingFactor) scalingFactor = maxScalingFactor;
            // Checking Y-axis boundary
            minLeeway = Math.min(
                Math.abs(BOUNDING_BOX.maxPosVal - relY - halfH),
                Math.abs(BOUNDING_BOX.maxNegVal - relY + halfH));
            maxScalingFactor = Math.min(1 + minLeeway / halfW, 1 + minLeeway / halfH);
            if (scalingFactor > maxScalingFactor) scalingFactor = maxScalingFactor;
            /**
             * Perform vertex resize
             */
            let ctrlFactorX = 0, ctrlFactorY = 0;
            if (Math.abs(layer.x) % 3 == 1.5) ctrlFactorX = 1.5;
            if (Math.abs(layer.y) % 3 == 1.5) ctrlFactorY = 1.5;
            for (var i = 0; i < currVtces.length; i++) {
                currVtces[i] = roundPosition(origVtces[i] * scalingFactor);
            }
            if (ctrlFactorX == 1.5) {
                if (currVtces[0] >= 0) {
                    currVtces[0] += ctrlFactorX;
                    currVtces[6] -= ctrlFactorX;
                }
                else {
                    currVtces[0] -= ctrlFactorX;
                    currVtces[6] += ctrlFactorX;
                }
                if (currVtces[2] >= 0) {
                    currVtces[2] += ctrlFactorX;
                    currVtces[4] -= ctrlFactorX;
                }
                else {
                    currVtces[2] -= ctrlFactorX;
                    currVtces[4] += ctrlFactorX;
                }
            }
            if (ctrlFactorY == 1.5) {
                if (currVtces[1] >= 0) {
                    currVtces[1] += ctrlFactorY;
                    currVtces[7] -= ctrlFactorY;
                }
                else {
                    currVtces[1] -= ctrlFactorY;
                    currVtces[7] += ctrlFactorY;
                }
                if (currVtces[3] >= 0) {
                    currVtces[3] += ctrlFactorY;
                    currVtces[5] -= ctrlFactorY;
                }
                else {
                    currVtces[3] -= ctrlFactorY;
                    currVtces[5] += ctrlFactorY;
                }
            }
            editor.updateLayer(layer);
            editor.render();
        }
        function directionalResizeSymbol(direction, clientPos, origValues) {
            let axis = 0; // Default to X-axis resize
            if (direction == 1) axis = 1; // Y-axis resize if direction is 1
            let canvas = $('canvas');
            let canvasPos = canvas.offset();
            let editor = canvas[0].editor;
            let layer = list.selectedElem.parentNode.elem;
            let origVtces = origValues.vtces;
            let currVtces = layer.vertices;
            // Get scaling factor from mousemove displacement (based on X-coord)
            let relPos = { left: clientPos.left - canvasPos.left, top: clientPos.top - canvasPos.top };
            let scalingFactor = 1.0;
            if (axis == 0) { // If horizontal resize, move cursor left/right to scale
                let dPosX = ((relPos.left / editor.zoom) - layer.x);
                scalingFactor = (1 + dPosX / 100);
            }
            else { // If vertical resize, move cursor up/down to scale
                let dPosY = ((relPos.top / editor.zoom) - layer.y);
                scalingFactor = (1 - dPosY / 100);
            }
            if (scalingFactor < 0.1) scalingFactor = 0.1;
            /**
             * Check if symbol will have a valid size
             */
            let maxlen = MAX_SYMBOL_SIDE_LEN;
            let testlen1x = Math.abs(origVtces[0] - origVtces[2]),
                testlen1y = Math.abs(origVtces[1] - origVtces[3]),
                testlen2x = Math.abs(origVtces[0] - origVtces[4]),
                testlen2y = Math.abs(origVtces[1] - origVtces[5]);
            let maxside = Math.max(testlen1x, testlen1y, testlen2x, testlen2y);
            let maxScalingFactor = maxlen / maxside;
            if (scalingFactor > maxScalingFactor) scalingFactor = maxScalingFactor;
            /**
             * Check if symbol will not trespass editor boundaries
             */
            var relX = (layer.x - (EDITOR_SIZE.x / 2)),
                relY = (layer.y - (EDITOR_SIZE.y / 2));
            let minVX = Math.min(origVtces[0], origVtces[2], origVtces[4], origVtces[6]),
                minVY = Math.min(origVtces[1], origVtces[3], origVtces[5], origVtces[7]),
                maxVX = Math.max(origVtces[0], origVtces[2], origVtces[4], origVtces[6]),
                maxVY = Math.max(origVtces[1], origVtces[3], origVtces[5], origVtces[7]);
            let halfW = Math.abs(maxVX - minVX) / 2, halfH = Math.abs(maxVY - minVY) / 2;
            // Checking X-axis boundary
            let minLeeway = Math.min(
                Math.abs(BOUNDING_BOX.maxPosVal - relX - halfW),
                Math.abs(BOUNDING_BOX.maxNegVal - relX + halfW));
            maxScalingFactor = 1 + minLeeway / halfW;
            if (scalingFactor > maxScalingFactor) scalingFactor = maxScalingFactor;
            // Checking Y-axis boundary
            minLeeway = Math.min(
                Math.abs(BOUNDING_BOX.maxPosVal - relY - halfH),
                Math.abs(BOUNDING_BOX.maxNegVal - relY + halfH));
            maxScalingFactor = Math.min(1 + minLeeway / halfW, 1 + minLeeway / halfH);
            if (scalingFactor > maxScalingFactor) scalingFactor = maxScalingFactor;
            /**
             * Perform vertex resize
             */
            let ctrlFactorX = 0, ctrlFactorY = 0;
            if (Math.abs(layer.x) % 3 == 1.5) ctrlFactorX = 1.5;
            if (Math.abs(layer.y) % 3 == 1.5) ctrlFactorY = 1.5;
            for (var i = axis; i < currVtces.length; i += 2) {
                currVtces[i] = roundPosition(origVtces[i] * scalingFactor);
                if (ctrlFactorX == 1.5) {
                    if (currVtces[i] >= 0) {
                        currVtces[i] += ctrlFactorX;
                    }
                    else {
                        currVtces[i] -= ctrlFactorX;
                    }
                }
            }
            editor.updateLayer(layer);
            editor.render();
        }
        this.editorBoxIcons = {
            tl: tl,
            tr: tr,
            br: br,
            bl: bl,
            left: btn_l,
            up: btn_u,
            right: btn_r,
            down: btn_d,
            rotation: btn_rot,
            resize: btn_resize,
            resizeX: btn_resizeX,
            resizeY: btn_resizeY
        };

        $('body').on('vmousemove', function (e) {
            // Mouse Move for Button Control
            var buttons = $(this).find('.edit-button');
            if (!buttons.is(":visible")) return;

            var editor = $('canvas')[0].editor;
            let btnActive = editor.currBtnDown;
            // Check if should proceed
            if (btnActive < 0) {
                return; // Avoids useless computation
            }
            // Make symbol edit box 80% transparent while editing
            buttons.css('opacity', 0.2).css('cursor', 'none');

            var pos = {
                left: Math.round(e.clientX),
                top: Math.round(e.clientY)
            }
            switch (btnActive) {
                case 0: // top left button
                case 1: // top right button
                    diagStretch(btnActive, pos, editor.origEditbtn);
                    break;
                case 2: // bottom right button
                case 3: // bottom left button
                    diagStretch(5 - btnActive, pos, editor.origEditbtn);
                    break;
                case 4: // left button
                case 5: // top button
                case 6: // right button
                case 7: // bottom button
                    sideStretch(btnActive - 4, pos, editor.origEditbtn);
                    break;
                case 8:
                    rotate(pos, editor.origEditbtn);
                    break;
                case 9:
                    resizeSymbol(pos, editor.origEditbtn);
                    break;
                case 10: // Horizontal Resize 
                case 11: // Vertical Resize
                    directionalResizeSymbol(btnActive - 10, pos, editor.origEditbtn);
                    break;
                default:
                    break;
            }
            editor.refreshLayerEditBox();
        }).on('vmouseup', function (e) {
            var buttons = $(this).find('.edit-button');
            if (!buttons.is(":visible")) return;
            buttons.css('opacity', 1).css('cursor', 'default');

            let editor = $('canvas')[0].editor;
            let btnUsed = editor.currBtnDown;
            // Deactivate any edit box button that may have been used
            editor.currBtnDown = -1;

            let reshapeType;
            switch (btnUsed) {
                case 0: case 1: case 2: case 3:
                    reshapeType = 'Diagonally Stretched';
                case 4: case 5: case 6: case 7:
                    reshapeType = reshapeType || 'Side Stretched';
                case 8:
                    reshapeType = reshapeType || 'Rotated';
                case 9:
                    reshapeType = reshapeType || 'Resized';
                case 10:
                    reshapeType = reshapeType || 'Horizontally Resized';
                case 11:
                    reshapeType = reshapeType || 'Vertically Resized';
                    let layer = list.selectedElem.parentNode.elem;
                    let vals = {
                        'layer': layer,
                        'origVals': {
                            vtces: editor.origEditbtn.vtces.slice(0),
                            x: editor.origEditbtn.x,
                            y: editor.origEditbtn.y
                        },
                        'newVals': {
                            vtces: layer.vertices.slice(0),
                            x: layer.x,
                            y: layer.y
                        }
                    };
                    let wasMeaningfulReshape = false;
                    if (vals.origVals.x != vals.newVals.x
                        || vals.origVals.y != vals.newVals.y)
                        wasMeaningfulReshape = true;
                    else {
                        for (var i = 0; i < vals.origVals.vtces.length; i++) {
                            if (vals.origVals.vtces[i] !== vals.newVals.vtces[i])
                                wasMeaningfulReshape = true;
                        }
                    }
                    if (wasMeaningfulReshape) {
                        historyManager.pushUndoAction('symbol_reshape', vals);
                        console.log('%c' + reshapeType + ' Symbol%c of layer "%s" in group "%s" at position "%i". '
                            + 'Vertices changed from %O to %O and position changed from (%i, %i) to (%i, %i).',
                            'color: #2fa1d6', 'color: #f3f3f3', layer.name, layer.parent.name,
                            layer.parent.elems.indexOf(layer), vals.origVals.vtces, vals.newVals.vtces,
                            vals.origVals.x, vals.origVals.y, vals.newVals.x, vals.newVals.y);
                    }
                default:
                    break;
            }
        })
        $(window).resize(function () {
            let editor = $('canvas')[0].editor;
            let newScalingFactor = window.innerWidth / (0.5 * EDITOR_SIZE.x);
            if (isMobile) {
                editor.ZOOM_STEP = newScalingFactor;
            }
            else {
                editor.ZOOM_STEP = newScalingFactor / 8;
            }
            editor.ZOOM_MIN = newScalingFactor / 4;
            editor.ZOOM_MAX = newScalingFactor * 4;
            if (editor.zoom < editor.ZOOM_MIN)
                editor.zoom = editor.ZOOM_MIN;
            else if (editor.zoom > editor.ZOOM_MAX)
                editor.zoom = editor.ZOOM_MAX;
            $('#canvascontainer').panzoom("option", {
                increment: editor.ZOOM_STEP,
                minScale: editor.ZOOM_MIN,
                maxScale: editor.ZOOM_MAX
            }).panzoom("zoom", this.zoom);
            editor.refreshLayerEditBox();
            if (editor.groupEditBox) editor.groupEditBox.updateUI();
            setTimeout(function () {
                $('canvas')[0].editor.refreshLayerEditBox();
            }, 100);
        });

        // Initialize Layer Control
        this.layerCtrl = new LayerCtrl(this);
        this.layerCtrl.hide();

        $('.canvas-box').append(this.editorBoxIcons.tl)
            .append(this.editorBoxIcons.tr)
            .append(this.editorBoxIcons.br)
            .append(this.editorBoxIcons.bl)
            .append(this.editorBoxIcons.left)
            .append(this.editorBoxIcons.up)
            .append(this.editorBoxIcons.right)
            .append(this.editorBoxIcons.down)
            .append(this.editorBoxIcons.rotation)
            .append(this.editorBoxIcons.resize)
            .append(this.editorBoxIcons.resizeX)
            .append(this.editorBoxIcons.resizeY);
        //Add the canvas to the HTML document
        parent.appendChild(this.renderer.view);

        $('canvas').addClass('editor-canvas-border');
        $('canvas')[0].editor = this;

        // Mobile Zooming Controller
        panZoomActive = false;
        $('#canvascontainer').panzoom({
            minScale: this.ZOOM_MIN,
            maxScale: this.ZOOM_MAX,
            increment: this.ZOOM_STEP,
            which: 2,
            cursor: 'pointer',
            disableOneFingerPan: true
        }).on("panzoomzoom", function (e, panzoom, scale, opts) {
            e.stopImmediatePropagation();
            let editor = $('canvas')[0].editor;
            editor.zoom = scale;
            editor.refreshLayerEditBox();
            editor.refreshLayerEditBoxScale();
            if (editor.groupEditBox) editor.groupEditBox.updateUI();
            $('canvas').trigger('vmouseup');
        }).on("panzoomstart", function (e, panzoom, event, touches) {
            editorToolbar.enableTool('resetPan');
            panZoomActive = true;
            $('canvas').trigger('vmouseup');
        }).on("panzoomend", function () {
            panZoomActive = false;
        }).on("panzoompan", function () {
            let editor = $('canvas')[0].editor;
            editor.refreshLayerEditBox();
            if (editor.groupEditBox) editor.groupEditBox.updateUI();
        });
        $('#canvascontainer').panzoom("zoom", this.zoom);

        this.render();
    },
    resize: function (w, h) {
        this.renderer.resize(w, h);
    },
    render: function () {
        //Tell the `this.renderer` to `render` the `this.stage`
        this.renderer.render(this.stage);
    },
    updateSize: function () {
        $('#canvascontainer').panzoom("zoom", this.zoom);

        this.refreshLayerEditBox();
    },
    incrSize: function () {
        if (this.zoom + this.ZOOM_STEP <= this.ZOOM_MAX) {
            this.zoom += this.ZOOM_STEP;

            $('#canvascontainer').panzoom("zoom", this.zoom);

            this.refreshLayerEditBox();
        }
    },
    decrSize: function () {
        if (this.zoom - this.ZOOM_STEP >= this.ZOOM_MIN) {
            this.zoom -= this.ZOOM_STEP;

            $('#canvascontainer').panzoom("zoom", this.zoom);

            this.refreshLayerEditBox();
        }
    },
    isFull: function () {
        if (this.layers.length > MAX_NUM_LAYERS) {
            console.warn(
            '%cEditor (%O):%c Number of layers in editor exceed the cap of %i '
            + 'layers. There are now %i layers in editor, those being: %O.',
            'color: #a6cd94', this, 'color: #d5d5d5', MAX_NUM_LAYERS, 
            this.layers.length, this.layers);
        }
        return (this.layers.length >= MAX_NUM_LAYERS);
    },
    isEmpty: function () {
        return (this.layers.length == 0);
    },
    createLayer: function (layer) {

        var quad = new PIXI.mesh.Plane(
          this.parts[layer.part], 2, 2
        );
        quad.tint = layer.color;
        quad.x = layer.x;
        quad.y = layer.y;
        quad.scale.x = layer.scaleX;
        quad.scale.y = layer.scaleY;
        quad.rotation = layer.rotation;
        for (var i = 0; i < quad.vertices.length; i++) {
            if (i % 2) quad.vertices[i] -= quad.x;
            else quad.vertices[i] -= quad.y;
        }
        return quad;
    },
    addLayer: function (layer) {
        // Add layer at top
        return this.addLayerAt(layer, 0);
    },
    addLayerAt: function (layer, index) {
        // Do not add if full
        if (this.isFull()) {
            console.log(
            '%cEditor:%c Could not add layer because editor is full (%i/%i).',
            'color: #a6cd94', 'color: #d5d5d5', this.layers.length, MAX_NUM_LAYERS);
            return null;
        }
        // Check if valid index (there are length-2 layers in editor + SA Box and Overlay)
        if (index < 0 || index > this.stage.children.length - 2) {
            console.error(
                '%cEditor (%O):%c Could not add layer %O to editor because'
                + 'provided index (%i) is invalid.',
                'color: #a6cd94', this, 'color: #d5d5d5', layer, index);
            return null;
        }
        var quad = this.createLayer(layer);
        var layerData = { layer: layer, quad: quad };
        // Check if layer is at the bottom
        if (index === undefined || index == this.stage.children.length - 2) {
            // Add quad to bottom
            this.stage.addChildAt(quad, 0);
            // save layer data in top-down order (last index is the bottom)
            this.layers.push(layerData);
        }
        else {
            // Add quad to specified position (index [length-3] = top, index [0] = bottom)
            // (index [length-1] = SA Box) => should never change
            // (index [length-2] = Overlay Image) => should never change
            this.stage.addChildAt(quad, this.stage.children.length - 2 - index);
            // save layer data in top-down order (index 0 is the topmost)
            this.layers.splice(index, 0, layerData);
        }
        this.updateLayer(layer);
        quad.editor = this;
        quad.layerData = layerData;
        quad.interactive = true;
        quad.on('mousedown', function (evtData) {
            let canvas = $('canvas')[0];
            if (canvas.editor.currBtnDown < 0) {
                this.origClickX = evtData.data.global.x;
                this.origClickY = evtData.data.global.y;
                this.origX = this.x;
                this.origY = this.y;
                canvas.movingQuad = this;
                this.editor.showLayerEditBox(0.2);
                this.isMoving = true;
            }
        }).on('touchstart', function (evtData) {
            let canvas = $('canvas')[0];
            if (!panZoomActive && $('canvas')[0].editor.currBtnDown < 0) {
                var newPosition = evtData.data.getLocalPosition(this.parent);
                this.origClickX = newPosition.x;
                this.origClickY = newPosition.y;
                this.origX = this.x;
                this.origY = this.y;
                canvas.movingQuad = this;
                this.editor.showLayerEditBox(0.2);
                this.isMoving = true;
            }
        });
        quad.on('mousemove', function (evtData) {
            if (this.isMoving && evtData.data.originalEvent.target.tagName == 'CANVAS') {
                let newX = this.origX + roundPosition(evtData.data.global.x - this.origClickX);
                let newY = this.origY + roundPosition(evtData.data.global.y - this.origClickY);
                /* Check horizontal limits (bounding box) */
                let maxNewX = (BOUNDING_BOX.maxPosVal) - ((this.width - EDITOR_SIZE.x) / 2);
                if (newX > maxNewX) newX = maxNewX;
                let minNewX = (BOUNDING_BOX.maxNegVal) + ((this.width + EDITOR_SIZE.x) / 2);
                if (newX < minNewX) newX = minNewX;
                /* Check vertical limits (bounding box) */
                let maxNewY = (BOUNDING_BOX.maxPosVal) - ((this.height - EDITOR_SIZE.y) / 2);
                if (newY > maxNewY) newY = maxNewY;
                let minNewY = (BOUNDING_BOX.maxNegVal) + ((this.height + EDITOR_SIZE.y) / 2);
                if (newY < minNewY) newY = minNewY;
                /* Perform quad position change */
                this.x = newX;
                this.y = newY;
                this.editor.render();
                if (this.editor.highlightedLayers != null)
                    this.alpha /= this.editor.LAYER_HIGHLIGHT_FACTOR; // Void highlight just to update layer
                this.layerData.layer.update(this);
                if (this.editor.highlightedLayers != null)
                    this.alpha *= this.editor.LAYER_HIGHLIGHT_FACTOR; // Restore highlight if necessary
                this.editor.layerCtrl.update(this.layerData.layer);
                this.editor.refreshLayerEditBox();
            }
        }).on('touchmove', function (evtData) {
            // Check if moving the selected layer (only one layer active)
            if (!panZoomActive && this.isMoving) {
                var newPosition = evtData.data.getLocalPosition(this.parent);
                let newX = this.origX + roundPosition(newPosition.x - this.origClickX);
                let newY = this.origY + roundPosition(newPosition.y - this.origClickY);
                /* Check horizontal limits (bounding box) */
                let maxNewX = (BOUNDING_BOX.maxPosVal) - ((this.width - EDITOR_SIZE.x) / 2);
                if (newX > maxNewX) newX = maxNewX;
                let minNewX = (BOUNDING_BOX.maxNegVal) + ((this.width + EDITOR_SIZE.x) / 2);
                if (newX < minNewX) newX = minNewX;
                /* Check vertical limits (bounding box) */
                let maxNewY = (BOUNDING_BOX.maxPosVal) - ((this.height - EDITOR_SIZE.y) / 2);
                if (newY > maxNewY) newY = maxNewY;
                let minNewY = (BOUNDING_BOX.maxNegVal) + ((this.height + EDITOR_SIZE.y) / 2);
                if (newY < minNewY) newY = minNewY;
                /* Perform quad position change */
                this.x = newX;
                this.y = newY;
                this.editor.render();
                if (this.editor.highlightedLayers != null)
                    this.alpha /= this.editor.LAYER_HIGHLIGHT_FACTOR; // Void highlight just to update layer
                this.layerData.layer.update(this);
                if (this.editor.highlightedLayers != null)
                    this.alpha *= this.editor.LAYER_HIGHLIGHT_FACTOR; // Restore highlight if necessary
                this.editor.layerCtrl.update(this.layerData.layer);
                this.editor.refreshLayerEditBox();
            }
        });
        /**
         * Set empty event handlers because PixiJS apparently
         * requires these to also be set is order for mousedown
         * and mousemove to fire
         */
        quad.on('mouseup', function (evtData) {
        }).on('touchend', function (evtData) {
        }).on('touchendoutside', function (evtData) {
        });
        /* Set mouseup handler on canvas container so symbol move
         * finishes up regardless of where the user fired the mouseup
         * (needed due to mouse not always remaining on top of symbol) */
        $('#canvascontainer').bind('vmouseup.symbolMouseup', function () {
            let movingQuad = $('canvas')[0].movingQuad;
            if (movingQuad === undefined) return;
            let layer = movingQuad.layerData.layer;
            if (movingQuad.isMoving // Save undoable action if moved symbol
                && (layer.x != movingQuad.origX || layer.y != movingQuad.origY)) {
                historyManager.pushUndoAction('symbol_move', {
                    'layer': layer,
                    'startX': movingQuad.origX,
                    'startY': movingQuad.origY,
                    'endX': layer.x,
                    'endY': layer.y
                });
                console.log('%cMoved Symbol%c of layer "%s" in group "%s" at position "%i" '
                    + 'from position (%i, %i) to (%i, %i).',
                    'color: #2fa1d6', 'color: #f3f3f3', layer.name, layer.parent.name,
                    layer.parent.elems.indexOf(layer),
                    movingQuad.origX, movingQuad.origY, layer.x, layer.y);
            }
            if (movingQuad.isMoving) {
                movingQuad.editor.showLayerEditBox(1);
                movingQuad.editor.refreshLayerEditBox();
            }
            movingQuad.isMoving = false;
            delete movingQuad.origClickX;
            delete movingQuad.origClickY;
            delete movingQuad.origX;
            delete movingQuad.origY;
            movingQuad = undefined;
        })
        this.layerCtrl.update(layerData.layer);
        return layerData;
    },
    removeLayer: function (layer) {
        var index = findWithAttr(this.layers, 'layer', layer);
        if (index == -1) {
            console.warn(
            '%cEditor (%O):%c Could not remove layer because layer "%O" was not found in editor "%O".',
            'color: #a6cd94', this, 'color: #d5d5d5', layer, this.layers);
            return null;
        }
        // Do not remove if empty
        if (this.isEmpty()) {
            console.log(
            '%cEditor:%c Could not remove layer because editor is empty (%i/%i).',
            'color: #a6cd94', 'color: #d5d5d5', this.layers.length, MAX_NUM_LAYERS);
            return null;
        }

        this.stage.removeChildAt(this.stage.children.length - 3 - index);
        var layerData = this.layers[index];
        this.layers.splice(index, 1);

        this.hideInterface();

        return layerData;

        function findWithAttr(array, attr, value) {
            for (var i = 0; i < array.length; i += 1) {
                var t = array[i][attr];
                if (array[i][attr] === value) {
                    return i;
                }
            }
            return -1;
        }
    },
    removeLayerAtTop: function () {
        // Do not remove if empty
        if (this.isEmpty()) {
            console.log(
            '%cEditor:%c Could not remove layer because editor is empty (%i/%i).',
            'color: #a6cd94', 'color: #d5d5d5', this.layers.length, MAX_NUM_LAYERS);
            return null;
        }
        // Remove top layer in editor
        // (index = length-2 because SA Box, the topmost layer, is at length-1)
        this.stage.removeChildAt(this.stage.children.length - 3);
        // Remove top layer data (at index 0 due to top-down ordering)
        var layerData = this.layers[0];
        this.layers.splice(0, 1);
        // Hide because selected layer is not in editor anymore
        this.hideInterface();

        return layerData;
    },
    getLayerIndex: function (layer) {
        for (var i = 0; i < this.layers.length; i += 1) {
            var t = this.layers[i].layer;
            if (this.layers[i].layer === layer) {
                return i;
            }
        }
        return -1;
    },
    updateLayer: function (layer) {
        var idx = findWithAttr(this.layers, 'layer', layer);
        if (idx == -1) {
            console.warn(
            '%cEditor (%O):%c Could not remove layer because layer "%O" was not found in editor "%O".',
            'color: #a6cd94', this, 'color: #d5d5d5', layer, this.layers);
            return null;
        }
        var quad = this.layers[idx].quad;
        quad.texture = this.parts[layer.part];
        quad.tint = layer.color;
        quad.x = layer.x;
        quad.y = layer.y;
        quad.scale.x = layer.scaleX;
        quad.scale.y = layer.scaleY;
        quad.rotation = layer.rotation;
        for (var i = 0; i < layer.vertices.length; i++) {
            quad.vertices[i] = layer.vertices[i];
        }

        switch (layer.alpha) {
            case 0: quad.alpha = 0.121569; break;
            case 1: quad.alpha = 0.247059; break;
            case 2: quad.alpha = 0.372549; break;
            case 3: quad.alpha = 0.498039; break;
            case 4: quad.alpha = 0.623529; break;
            case 5: quad.alpha = 0.74902; break;
            case 6: quad.alpha = 0.87451; break;
            case 7: quad.alpha = 1; break;
        }

        if (this.highlightedLayers != null) {
            let startIdx = this.getLayerIndex(this.highlightedLayers[0]);
            if (startIdx >= 0 && startIdx < this.layers.length
                && idx >= startIdx && idx < startIdx + this.highlightedLayers[1]) {
                quad.alpha *= this.LAYER_HIGHLIGHT_FACTOR;
            }
        }

        function findWithAttr(array, attr, value) {
            for (var i = 0; i < array.length; i += 1) {
                var t = array[i][attr];
                if (array[i][attr] === value) {
                    return i;
                }
            }
            return -1;
        }
    },
    enableInteraction: function (layer) {
        let foundQuad = false;
        for (var i = 0; i < this.layers.length; i++) {
            if (!foundQuad && this.layers[i].layer == layer) {
                // Make the selected interactive
                this.layers[i].quad.interactive = true;
                foundQuad = true; // First match found
            }
            else {
                // Disable interaction for all other unselected layers
                this.layers[i].quad.interactive = false;
            }
        }
    },
    disableInteraction: function (layer) {
        var quad = null;
        for (var i = 0; i < this.layers.length; i++) {
            this.layers[i].quad.interactive = false;
        }
    },
    updateGroupEditBoxSize: function () {
        if (!this.groupMoving) return;
        this.groupMoving.maxXCoord = Number.MIN_VALUE,
        this.groupMoving.minXCoord = Number.MAX_VALUE,
        this.groupMoving.maxYCoord = Number.MIN_VALUE,
        this.groupMoving.minYCoord = Number.MAX_VALUE;
        var layer;
        for (var i = this.groupMoving.firstIdx; i < this.groupMoving.lastIdx; i++) {
            layer = this.layers[i].layer;
            let maxX = layer.x + Math.max(
                layer.vertices[0], layer.vertices[2],
                layer.vertices[4], layer.vertices[6]);
            if (maxX > this.groupMoving.maxXCoord) this.groupMoving.maxXCoord = maxX;
            let minX = layer.x + Math.min(
                layer.vertices[0], layer.vertices[2],
                layer.vertices[4], layer.vertices[6]);
            if (minX < this.groupMoving.minXCoord) this.groupMoving.minXCoord = minX;
            let maxY = layer.y + Math.max(
                layer.vertices[1], layer.vertices[3],
                layer.vertices[5], layer.vertices[7]);
            if (maxY > this.groupMoving.maxYCoord) this.groupMoving.maxYCoord = maxY;
            let minY = layer.y + Math.min(
                layer.vertices[1], layer.vertices[3],
                layer.vertices[5], layer.vertices[7]);
            if (minY < this.groupMoving.minYCoord) this.groupMoving.minYCoord = minY;
        }
        if (this.groupEditBox) this.groupEditBox.displace(0, 0);
    },
    enableGroupInteraction: function (folder) {
        let canvas = $('canvas');
        canvas[0].movingFolder = folder;
        if (!list.selectedElem) return;
        this.groupMoving = {};
        let lis = $(list.container).find('li');
        let lisInGroup = $(list.selectedElem.parentNode.parentNode).find('li');
        if (lisInGroup.length <= 0) return; // Cancel if no layer inside group
        this.groupMoving.firstIdx = lis.index(lisInGroup[0]);
        if (this.groupMoving.firstIdx < 0) return; // Cancel if not found
        this.groupMoving.lastIdx = this.groupMoving.firstIdx + lisInGroup.length;

        let editor = canvas[0].editor;
        let groupMoving = editor.groupMoving;
        groupMoving.origColor = [];
        groupMoving.origAlpha = [];
        for (var i = groupMoving.firstIdx; i < groupMoving.lastIdx; i++) {
            layer = editor.layers[i].layer;
            groupMoving.origColor.push(layer.color);
            groupMoving.origAlpha.push(layer.alpha);
        }

        editor.groupEditBox = new GroupEditBox(this.groupMoving);
        this.updateGroupEditBoxSize();

        // Handlers for mousemove-based group motion
        let groupMoveMousedownHandler = function (e) {
            e.stopPropagation();
            if (!panZoomActive
                && list.selectedElem.parentNode.elem.type == 'g') {
                let editor = $('canvas')[0].editor;
                let groupMoving = editor.groupMoving;
                if (groupMoving === undefined) return;
                var ev = e.originalEvent.originalEvent;
                if (ev instanceof MouseEvent) { // Desktop mouse event
                    groupMoving.origClickX = e.originalEvent.offsetX;
                    groupMoving.origClickY = e.originalEvent.offsetY;
                }
                else if (ev instanceof TouchEvent) { // Mobile device touch event
                    groupMoving.origClickX = ((ev.touches[0].pageX - ev.touches[0].target.offsetLeft) / editor.zoom);
                    groupMoving.origClickY = ((ev.touches[0].pageY - ev.touches[0].target.offsetTop) / editor.zoom);
                }
                groupMoving.origXPos = [];
                groupMoving.origYPos = [];
                var layer;
                for (var i = groupMoving.firstIdx; i < groupMoving.lastIdx; i++) {
                    layer = editor.layers[i].layer;
                    groupMoving.origXPos.push(layer.x);
                    groupMoving.origYPos.push(layer.y);
                }
                editor.updateGroupEditBoxSize();
                groupMoving.width = groupMoving.maxXCoord - groupMoving.minXCoord;
                groupMoving.height = groupMoving.maxYCoord - groupMoving.minYCoord;
                // Check if something went wrong
                if (groupMoving.width < 0 || groupMoving.height < 0) {
                    groupMoving = undefined; // Release info and return
                    return;
                }
                groupMoving.xPos = groupMoving.maxXCoord - (groupMoving.width / 2);
                groupMoving.yPos = groupMoving.maxYCoord - (groupMoving.height / 2);

                editor.groupEditBox.displace(0, 0);

                this.mouseDown = true;
                this.hasChangedGroupPos = false;
            }
        }
        let groupMoveMousemoveHandler = function (e) {
            e.stopPropagation();
            if (!panZoomActive
                && this.mouseDown) {
                let editor = $('canvas')[0].editor;
                let groupMoving = editor.groupMoving;
                if (groupMoving === undefined) return;
                if (groupMoving.firstIdx < 0) return;
                if (GroupEditBox.isVisible()) GroupEditBox.container.css('opacity', 0.2);
                var layer;
                var dPosX;
                var dPosY;
                var ev = e.originalEvent.originalEvent;
                if (ev instanceof MouseEvent) { // Desktop mouse event
                    dPosX = roundPosition(e.originalEvent.offsetX - groupMoving.origClickX);
                    dPosY = roundPosition(e.originalEvent.offsetY - groupMoving.origClickY);
                }
                else if (ev instanceof TouchEvent) { // Mobile device touch event
                    dPosX = roundPosition((ev.touches[0].pageX - ev.touches[0].target.offsetLeft) / editor.zoom - groupMoving.origClickX);
                    dPosY = roundPosition((ev.touches[0].pageY - ev.touches[0].target.offsetTop) / editor.zoom - groupMoving.origClickY);
                }
                /* Check horizontal limits (bounding box) */
                let maxDPosX = (BOUNDING_BOX.maxPosVal)
                    - (groupMoving.xPos + ((groupMoving.width - EDITOR_SIZE.x) / 2));
                if (maxDPosX < 0) maxDPosX = 0;
                if (dPosX > maxDPosX) dPosX = maxDPosX;
                let minDPosX = (BOUNDING_BOX.maxNegVal)
                    - (groupMoving.xPos - ((groupMoving.width + EDITOR_SIZE.x) / 2));
                if (minDPosX > 0) minDPosX = 0;
                if (dPosX < minDPosX) dPosX = minDPosX;
                /* Check vertical limits (bounding box) */
                let maxDPosY = (BOUNDING_BOX.maxPosVal)
                    - (groupMoving.yPos + ((groupMoving.height - EDITOR_SIZE.y) / 2));
                if (maxDPosY < 0) maxDPosY = 0;
                if (dPosY > maxDPosY) dPosY = maxDPosY;
                let minDPosY = (BOUNDING_BOX.maxNegVal)
                    - (groupMoving.yPos - ((groupMoving.height + EDITOR_SIZE.y) / 2));
                if (minDPosY > 0) minDPosY = 0;
                if (dPosY < minDPosY) dPosY = minDPosY;
                /* Perform group position change */
                for (var i = groupMoving.firstIdx; i < groupMoving.lastIdx; i++) {
                    layer = editor.layers[i].layer;
                    if (ev instanceof MouseEvent) { // Desktop mouse event
                        layer.x = groupMoving.origXPos[i - groupMoving.firstIdx] + dPosX;
                        layer.y = groupMoving.origYPos[i - groupMoving.firstIdx] + dPosY;
                        if (!this.hasChangedGroupPos // Check to see if should push to history after done
                            && (layer.x != groupMoving.origXPos[i - groupMoving.firstIdx]
                            || layer.y != groupMoving.origYPos[i - groupMoving.firstIdx])) {
                            this.hasChangedGroupPos = true;
                        }
                    }
                    else if (ev instanceof TouchEvent) { // Mobile device touch event
                        layer.x = groupMoving.origXPos[i - groupMoving.firstIdx] + dPosX;
                        layer.y = groupMoving.origYPos[i - groupMoving.firstIdx] + dPosY;
                        if (!this.hasChangedGroupPos // Check to see if should push to history after done
                            && (layer.x != groupMoving.origXPos[i - groupMoving.firstIdx]
                            || layer.y != groupMoving.origYPos[i - groupMoving.firstIdx])) {
                            this.hasChangedGroupPos = true;
                        }
                    }
                    editor.updateLayer(layer);
                }
                editor.render();
                editor.groupEditBox.displace(dPosX, dPosY);
            }
        }
        let groupMoveMouseupHandler = function (e) {
            e.stopPropagation();
            this.mouseDown = undefined;
            if (this.hasChangedGroupPos) {
                this.hasChangedGroupPos = undefined;
                let editor = $('canvas')[0].editor;
                if (GroupEditBox.isVisible()) GroupEditBox.container.css('opacity', 1);
                let groupMoving = editor.groupMoving;
                if (groupMoving === undefined) return;
                let endX = [];
                let endY = [];
                var layer;
                for (var i = groupMoving.firstIdx; i < groupMoving.lastIdx; i++) {
                    layer = editor.layers[i].layer;
                    endX[i] = layer.x;
                    endY[i] = layer.y;
                }

                historyManager.pushUndoAction('symbol_groupmove', {
                    'startIdx': groupMoving.firstIdx,
                    'endIdx': groupMoving.lastIdx,
                    'startX': groupMoving.origXPos,
                    'startY': groupMoving.origYPos,
                    'endX': endX,
                    'endY': endY
                });
                console.log('%cMoved Group of Symbols%c in group "%s".',
                    'color: #2fa1d6', 'color: #f3f3f3', list.selectedElem.parentNode.elem.name);
                this.endX = undefined;
                this.endY = undefined;
            }
            this.hasChangedGroupPos = undefined;
        }
        canvas.bind('vmousedown.saGroupMousedown', groupMoveMousedownHandler)
            .bind('vmousemove.saGroupMousemove', groupMoveMousemoveHandler)
            .bind('vmouseup.saGroupMouseup', groupMoveMouseupHandler);
        $('body')
            .unbind('vmouseup.saGroupMouseup')
            .bind('vmouseup.saGroupMouseup', function (e) {
                $('canvas').trigger('vmouseup');
            });
    },
    disableGroupInteraction: function () {
        let canvas = $('canvas');

        canvas[0].movingFolder = undefined;
        GroupEditBox.hide();
        canvas[0].editor.groupEditBox = undefined;
        canvas[0].editor.groupMoving = undefined;

        canvas.unbind('vmousedown.saGroupMousedown')
            .unbind('vmousemove.saGroupMousemove')
            .unbind('vmouseup.saGroupMouseup');
        $('body').unbind('vmouseup.saGroupMouseup');
    },
    setHighlightedLayers: function (startLayer, optionalLength) {
        if (this.highlightedLayers != null) {
            this.stopHighlightingLayers();
        }
        if (startLayer === undefined) return;
        let length =
            (optionalLength !== undefined && typeof optionalLength === 'number'
            && optionalLength <= this.layers.length) ?
            optionalLength : 1; // Inclusive
        this.highlightedLayers = [startLayer, length];
        this.stage.alpha = 1.0 / this.LAYER_HIGHLIGHT_FACTOR;
        let startIdx = this.getLayerIndex(startLayer);
        for (var i = startIdx; i < startIdx + length; i++) {
            if (this.layers[i])
                this.layers[i].quad.alpha *= this.LAYER_HIGHLIGHT_FACTOR;
        }
    },
    refreshHighlightedLayers: function () {
        if (this.highlightedLayers == null) return;
        let startIdx = this.getLayerIndex(this.highlightedLayers[0]);
        if (startIdx < 0 || startIdx >= this.layers.length) return;
        for (var i = startIdx; i < startIdx + this.highlightedLayers[1]; i++) {
            if (this.layers[i] && this.layers[i].quad.alpha <= 1)
                this.layers[i].quad.alpha *= this.LAYER_HIGHLIGHT_FACTOR;
        }
    },
    stopHighlightingLayers: function () {
        if (this.highlightedLayers == null) return;
        this.stage.alpha = 1.0;
        for (var i = 0; i < this.layers.length; i++) {
            // If layer is highlighted, it will have a higher alpha value then 1
            // in that case, reset its alpha value
            if (this.layers[i].quad.alpha > 1)
                this.layers[i].quad.alpha /= this.LAYER_HIGHLIGHT_FACTOR;
        }
        this.highlightedLayers = null;
    },
    hideInterface: function () {
        this.layerCtrl.hide();
        this.hideLayerEditBox();
        if (this.groupEditBox) GroupEditBox.hide();
    },
    showInterface: function () {
        if (this.selectedLayer == null
            || this.selectedLayer.visible == false) return;
        this.layerCtrl.show();
        this.showLayerEditBox();
    },
    changeLayerVisibility: function (bool, idx, optionalIdx) {
        if (bool === undefined || typeof bool !== 'boolean'
            || idx === undefined || typeof idx !== 'number'
            || idx < 0 || idx >= this.layers.length) return;
        let startIdx = idx;
        let endIdx =
            (optionalIdx !== undefined && typeof optionalIdx === 'number'
            && optionalIdx > idx && optionalIdx <= this.layers.length) ?
            optionalIdx : idx + 1; // Inclusive
        for (var i = startIdx; i < endIdx; i++) {
            if (this.layers[i])
                this.layers[i].layer.visible = bool;
                this.layers[i].quad.visible = bool;
        }
    },
    hideLayerEditBox: function () {
        this.editorBoxIcons.tl.hide();
        this.editorBoxIcons.tr.hide();
        this.editorBoxIcons.bl.hide();
        this.editorBoxIcons.br.hide();
        this.editorBoxIcons.left.hide();
        this.editorBoxIcons.up.hide();
        this.editorBoxIcons.right.hide();
        this.editorBoxIcons.down.hide();
        this.editorBoxIcons.rotation.hide();
        this.editorBoxIcons.resize.hide();
        this.editorBoxIcons.resizeX.hide();
        this.editorBoxIcons.resizeY.hide();
    },
    showLayerEditBox: function (optOpacity) {
        this.overlayImg.toggleController(false);
        this.editorBoxIcons.tl.show();
        this.editorBoxIcons.tr.show();
        this.editorBoxIcons.bl.show();
        this.editorBoxIcons.br.show();
        this.editorBoxIcons.left.show();
        this.editorBoxIcons.up.show();
        this.editorBoxIcons.right.show();
        this.editorBoxIcons.down.show();
        this.editorBoxIcons.rotation.show();
        this.editorBoxIcons.resize.show();
        this.editorBoxIcons.resizeX.show();
        this.editorBoxIcons.resizeY.show();
        if (optOpacity !== undefined) {
            let buttons = $('.edit-button');
            buttons.css('opacity', optOpacity);
        }
    },
    refreshLayerEditBox: function () {
        if (this.selectedLayer == null
            || this.selectedLayer.visible == false) return;
        if (this.editorBoxIcons.tl.is(':hidden')) return; // Ignore if UI is hidden
        var basePosX = this.selectedLayer.x;
        var basePosY = this.selectedLayer.y;
        var v = this.selectedLayer.vertices;
        this.editorBoxIcons.tl.css('left', (basePosX + v[0] - 11.3) + 'px')
            .css('top', (basePosY + v[1] - 12.5) + 'px');
        this.editorBoxIcons.tr.css('left', (basePosX + v[2] - 11.3) + 'px')
            .css('top', (basePosY + v[3] - 12.5) + 'px');
        this.editorBoxIcons.bl.css('left', (basePosX + v[4] - 11.3) + 'px')
            .css('top', (basePosY + v[5] - 12.5) + 'px');
        this.editorBoxIcons.br.css('left', (basePosX + v[6] - 11.3) + 'px')
            .css('top', (basePosY + v[7] - 12.5) + 'px');

        this.editorBoxIcons.left.css('left', (basePosX + ((v[0] + v[4])) / 2 - 11.3) + 'px')
            .css('top', (basePosY + ((v[1] + v[5])) / 2 - 12.5) + 'px');
        this.editorBoxIcons.up.css('left', (basePosX + ((v[0] + v[2])) / 2 - 11.3) + 'px')
            .css('top', (basePosY + ((v[1] + v[3])) / 2 - 12.5) + 'px');
        this.editorBoxIcons.right.css('left', (basePosX + ((v[2] + v[6])) / 2 - 11.3) + 'px')
            .css('top', (basePosY + ((v[3] + v[7])) / 2 - 12.5) + 'px');
        this.editorBoxIcons.down.css('left', (basePosX + ((v[4] + v[6])) / 2 - 11.3) + 'px')
            .css('top', (basePosY + ((v[5] + v[7])) / 2 - 12.5) + 'px');

        this.editorBoxIcons.rotation.css('left', (basePosX - 11.3) + 'px')
            .css('top', (basePosY - 42.5) + 'px');
        this.editorBoxIcons.resize.css('left', (basePosX - 11.3) + 'px')
            .css('top', (basePosY + 17.5) + 'px');
        this.editorBoxIcons.resizeX.css('left', (basePosX + 18.7) + 'px')
            .css('top', (basePosY - 12.5) + 'px');
        this.editorBoxIcons.resizeY.css('left', (basePosX - 41.3) + 'px')
            .css('top', (basePosY - 12.5) + 'px');
    },
    refreshLayerEditBoxScale: function () {
        let inverseScale = 'scale(' + (1 / this.zoom) + ',' + (1 / this.zoom) + ')';
        let inverseMatrix = inverseScale + 'rotate(-45deg)';
        this.editorBoxIcons.tl.css('transform', inverseMatrix);
        this.editorBoxIcons.tr.css('transform', inverseMatrix);
        this.editorBoxIcons.bl.css('transform', inverseMatrix);
        this.editorBoxIcons.br.css('transform', inverseMatrix);

        this.editorBoxIcons.left.css('transform', inverseScale);
        this.editorBoxIcons.up.css('transform', inverseScale);
        this.editorBoxIcons.right.css('transform', inverseScale);
        this.editorBoxIcons.down.css('transform', inverseScale);

        this.editorBoxIcons.rotation.css('transform', inverseScale);
        this.editorBoxIcons.resize.css('transform', inverseScale);
        this.editorBoxIcons.resizeX.css('transform', inverseScale);
        this.editorBoxIcons.resizeY.css('transform', inverseScale);
    },
    refreshLayerEditBoxButton: function (index) {
        if (this.selectedLayer == null
            || this.selectedLayer.visible == false) return;
        var sel = {};
        sel.index = 2 * index;
        switch (index) {
            case 0:
                sel.obj = this.editorBoxIcons.tl; sel.offset = 14.8;
                break;
            case 1:
                sel.obj = this.editorBoxIcons.tr; sel.offset = 54;
                break;
            case 2:
                sel.obj = this.editorBoxIcons.bl; sel.offset = 134;
                break;
            case 3:
                sel.obj = this.editorBoxIcons.br; sel.offset = 93.2;
                break;
            default:
                console.warn(
                    'Editor.refreshLayerEditBoxButton: Could not refresh edit box button of index "'
                    + index + '".');
                return;
        }

        var offset = $('canvas').offset();
        var posX = offset.left
            + this.zoom * (this.selectedLayer.x + this.selectedLayer.vertices[sel.index])
            - sel.offset;
        var posY = offset.top
            + this.zoom * (this.selectedLayer.y + this.selectedLayer.vertices[sel.index + 1])
            - 22.8;
        sel.obj.css('left', posX + 'px')
            .css('top', posY + 'px');
    },
    refreshDisplay: function () {
        this.stage.removeChildren();
        this.layers = [];

        // Add control layers on top
        this.stage.addChild(this.overlayImg.getImage());
        this.stage.addChild(this.SABox);
        // Then add existing symbols below it
        refreshGroupDisplay(this.mainGroup, this);

        function refreshGroupDisplay(currGroup, editor) {
            // Add all layers inside group in bottom to top layer order
            for (var i = currGroup.elems.length - 1; i >= 0; i--) {
                let elem = currGroup.elems[i];
                if (elem.type == 'l') { // If a layer
                    // Add layer to the editor
                    // (at bottom layer of editor because of for-loop ordering)
                    let layerData = editor.addLayer(elem);
                    // Match quad visibility with layer info
                    layerData.quad.visible = elem.visible;
                    layerData.quad.interactive = false; // Default interactiveness is false
                }
                else if (elem.type == 'g') { // If a group
                    // Recursively add layers inside it
                    refreshGroupDisplay(elem, editor);
                }
            }
        }
    }
});

function roundPosition (val) {
    return Math.round(val / CANVAS_PIXEL_SCALE) * CANVAS_PIXEL_SCALE;
}