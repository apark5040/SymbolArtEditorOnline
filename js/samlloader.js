﻿/**
 * Creates a <tt>.SAML<tt> file loader that allows parsing and loading 
 * <tt>.SAML<tt> files into the app editor.
 * @class SAMLLoader
 * @param {List} list The .SAML file to be parsed.
 */
var isLoadingSAML = false;
var onLoadNumWarnings = -1;
var SAMLLoader = Class({
    initialize: function (list) {
        // TODO
        this.list = list;
        this.editor = list.editor;
    },
    /**
     * Loads the contents of a <tt>.SAML<tt> string into the editor.
     * @memberof SAMLLoader
     * @param {String} SAMLText The .SAML string to be parsed.
     * @returns {void}
     */
    load: function (SAMLText) {
        // Temporarily disable normal logging for loading purposes
        let savedConsoleLogCallback = console.log;
        console.log = function () { }
        isLoadingSAML = true;
        onLoadNumWarnings = 0;
        bgeNumToBe = -1;

        // TODO
        try {
            var xmlTags = SAMLText.match(/<\?xml([ ]+[A-Z|a-z][A-Z|a-z|0-9|_]*[A-Z|a-z|0-9]*="[^"|\n]+")*[ ]*\?>/g);
            if (xmlTags == null || xmlTags.length <= 0) {
                // No xml tag found
            }
            else {
                // Found an xml tag
            }

            this.setupOverlay(SAMLText);

            var mainFolder = this.list.container[0].firstChild;
            var currFolder = mainFolder;

            // Get all tags found in string
            var tags = SAMLText.match(/<[^\n|<]*>/g);
            if (!tags || tags.length == 0) {
                console.error(
                    '%cSAML Loader (%O):%c Could not load file given. Text:\n%s.',
                    'color: #a6cd94', this, 'color: #d5d5d5', SAMLText);
                alert('Loaded file is incompatible.');
                // Restore normal logging functionality
                console.log = savedConsoleLogCallback;
                return false;
            }
            var nestingLvl = 0;
            var isValid = false;
            $('#numToLoad').text(tags.length);
            $('#loadPreview').css('opacity', 1);
            $('.landing-menu').css('pointer-events', 'none');
            let i = 0;
            loadNextTag();
            var that = this;
            function loadNextTag() {
                try {
                    if (i >= tags.length) {
                        finishLoading();
                        return;
                    }
                    console.log = function () { };
                    $('#numLoaded').text(i);
                    var tag = tags[i];
                    if (isValid && /<layer>|<layer [^\n|<]*>/.test(tag)) { // if <layer>
                        if (that.editor.isFull()) {
                            console.warn(
                                '%cSAML Loader (%O):%c Layer info (%s) could not be loaded.'
                                + ' Editor has reached its layer capacity (%i).',
                                'color: #a6cd94', that, 'color: #d5d5d5', tag, MAX_NUM_LAYERS);
                            onLoadNumWarnings++;
                        }
                        else {
                            contextMenuCallback('insert layer', null, null, $(currFolder.firstChild));
                            var newLayerNode = currFolder.lastChild.firstChild.lastChild;
                            that.setupElem(newLayerNode, tag, 'layer');
                        }
                    }
                    else if (isValid && /<g>|<g [^\n|<]*>/.test(tag)) { // if <g>
                        contextMenuCallback('insert group', null, null, $(currFolder.firstChild));
                        currFolder = currFolder.lastChild.firstChild.lastChild;
                        that.setupElem(currFolder, tag, 'g');
                        nestingLvl++;
                    }
                    else if (isValid && /<\/([a-z|A-Z]+[0-9]?)>/.test(tag)) {
                        if (/<\/g>/.test(tag)) { // if </g>
                            if (nestingLvl > 0) {
                                currFolder = currFolder.parentNode.parentNode.parentNode;
                                nestingLvl--;
                            }
                        }
                        else if (/<\/sa>/.test(tag)) { // if </sa>
                            finishLoading();
                            return;
                        }
                    }
                    else if (/<sa>|<sa [^\n|<]*>/.test(tag)) {
                        that.setupElem(mainFolder, tag, 'sa');
                        isValid = true;
                    }

                    i++;
                    setTimeout(loadNextTag, 1);
                }
                catch (e) {
                    $('.landing-menu').css('pointer-events', 'auto');
                    // Restore normal logging functionality
                    console.log = savedConsoleLogCallback;
                    throw e;
                }
            }

            function finishLoading() {
                $('.landing-menu').css('pointer-events', 'auto');
                if (!isValid || nestingLvl > 0) alert('Loaded file is malformed, it may not be compatible.');

                that.editor.render();
                that.editor.hideInterface();
                //this.editor.overlayImg.toggleController(false);
                list.updateDOMGroupVisibility(list.mainFolder[0]);

                $(mainFolder).children(':first').click();

                let bgeMan = $('#player')[0].manager.bgeselect;
                bgeMan.setActiveBGE(bgeNumToBe);
                bgeMan.selectmenu.setSelectedOption(bgeNumToBe, 1);

                isLoadingSAML = false;

                console.log = savedConsoleLogCallback;
            }
        }
        catch (e) {
            // Restore normal logging functionality
            console.log = savedConsoleLogCallback;
            throw e;
        }
        // Restore normal logging functionality
        console.log = savedConsoleLogCallback;
        if (onLoadNumWarnings > 0) {
            alert('Loaded Symbol Art contains invalid information ('
                + onLoadNumWarnings + ' warnings logged). It can be edited '
                + 'but unexpected behavior may be experienced.');
        }
        return isValid;
    },
    setupElem: function (node, tag, type) {
        // Get all key="value" pairs in tag
        var pairs = tag.match(/([A-Z|a-z][A-Z|a-z|0-9|_]*[A-Z|a-z|0-9]*="[^"|\n]+")+/g);
        var rawVtces = [];
        for (var i = 0; i < pairs.length; i++) {
            var keyValue = pairs[i].split('=');
            var key = keyValue[0];
            var value = keyValue[1].match(/([^"|\n]+)/)[0].trim();

            switch (key) {
                case 'name':
                    if (!LAYER_NAME_REGEX.test(value)) {
                        console.warn(
                            '%cSAML Loader (%O):%c Layer/group element %O contains an invalid name.'
                            + ' Please rename it soon.',
                            'color: #a6cd94', this, 'color: #d5d5d5', node.elem);
                        onLoadNumWarnings++;
                    }
                    // Use Valid or Invalid Info (wont affect much)
                    if (type == 'layer') {
                        node.elem.name = value;
                        $(node).find('span:first').text(value); // Update name of elem in node
                    }
                    else if (type == 'g' || type == 'sa') {
                        node.firstChild.elem.name = value;
                        $(node).find('span:first').text(value); // Update name of elem in node
                    }
                    break;
                case 'visible':
                    if (type == 'layer') {
                        value = (value === "true") ? true : false;
                        list.changeElemVisibility(value, node);
                    }
                    else if (type == 'g' || type == 'sa') {
                        value = (value === "true") ? true : false;
                        list.changeElemVisibility(value, node.firstChild);
                    }
                    break;
                case 'version':
                    value = parseInt(value);
                    if (type == 'sa' && typeof value === 'number') SAConfig.version = ++value;
                    // else leave the default version 1
                    break;
                case 'author':
                    value = parseInt(value);
                    if (type == 'sa' && typeof value === 'number' // Check if an 8-digit number
                        && value >= 0 && value <= 99999999) SAConfig.authorID = value;
                    break;
                case 'width':
                    if (type == 'sa') {
                        // Application assumes 192px width for Symbol Art
                    }
                    break;
                case 'height':
                    if (type == 'sa') {
                        // Aplication assumes 96px height for Symbol Art
                    }
                    break;
                case 'sound':
                    if (type == 'sa') {
                        value = parseInt(value);
                        if (value === undefined || value < 0 || value >= $('#player')[0].bges.length) {
                            console.warn(
                                '%cSAML Loader (%O):%c Symbol Art uses an invalid sound effect (BGE "%i").'
                                + ' Setting to default BGE.',
                                'color: #a6cd94', this, 'color: #d5d5d5', value);
                            onLoadNumWarnings++;
                            value = 0;
                        }
                        bgeNumToBe = value;
                    }
                    break;
                case 'type':
                    if (type == 'layer') {
                        value = parseInt(value);
                        // +1 due to SAML parts format starting from 240 and not 241
                        var partIdx = partsInfo.dataArray.indexOf((value + 1).toString());
                        if (value === undefined || !this.editor.parts[partIdx]) {
                            // Invalid Input
                            console.warn(
                                '%cSAML Loader (%O):%c Layer/group element %O uses an invalid symbol number "%i".'
                                + ' Using default symbol (symbol number 293).',
                                'color: #a6cd94', this, 'color: #d5d5d5', node.elem, value);
                            onLoadNumWarnings++;
                            // Set default blank image
                            partIdx = partsInfo.dataArray.indexOf((293).toString());
                        }
                        node.elem.part = partIdx;
                        $(node).find('img')[0].src = partsInfo.path
                            + partsInfo.dataArray[partIdx] + partsInfo.imgType;
                    }
                    break;
                case 'color':
                    if (type == 'layer') {
                        value = value.match(/([0-9|a-f|A-F]{3,6})/)[0];
                        var color = hexToRgb(value);
                        value = parseInt('0x' + rgbToHex(color));
                        if (value === undefined) {
                            // Invalid Input
                            break;
                        }
                        node.elem.color = value;
                    }
                    break;
                case 'alpha':
                    if (type == 'layer') {
                        value = parseFloat(value);
                        if (value === undefined) {
                            // Invalid Input
                            console.warn(
                                '%cSAML Loader (%O):%c Layer/group element %O has invalid transparency value "%i".'
                                + ' Using default value (1).',
                                'color: #a6cd94', this, 'color: #d5d5d5', node.elem, value);
                            onLoadNumWarnings++;
                            break;
                        }
                        node.elem.alpha = 0; // Default
                        /* Convert alpha so it is compatible with this application */
                        // WHEN file is in format output by THIS application
                        if (value > 1) {
                            node.elem.alpha = 7 - ((value - 1) / 32);
                        }
                        // WHEN file is in format output by the third-party
                        // .NET Symbol Art Editor desktop application (refer to README)
                        else {
                            switch (value) {
                                case 0.247059: node.elem.alpha = 1; break;
                                case 0.372549: node.elem.alpha = 2; break;
                                case 0.498039: node.elem.alpha = 3; break;
                                case 0.623529: node.elem.alpha = 4; break;
                                case 0.74902: node.elem.alpha = 5; break;
                                case 0.87451: node.elem.alpha = 6; break;
                                case 1: node.elem.alpha = 7; break;
                            }
                        }
                    }
                    break;
                case 'ltx':
                    if (type == 'layer') {
                        value = parseInt(value);
                        if (value === undefined) {
                            // Invalid Input
                            console.warn(
                                '%cSAML Loader (%O):%c Layer/group element %O has invalid top-left vertex X value "%i".'
                                + ' Using default value (%i).',
                                'color: #a6cd94', this, 'color: #d5d5d5', node.elem, value, rawVtces[0]);
                            onLoadNumWarnings++;
                            break;
                        }
                        if (value < BOUNDING_BOX_RAW.maxNegVal) {
                            console.warn(
                                '%cSAML Loader (%O):%c Layer/group element %O has invalid top-left '
                                + 'vertex X value "%i" (exceeds min %i).',
                                'color: #a6cd94', this, 'color: #d5d5d5', node.elem, value,
                                BOUNDING_BOX_RAW.maxNegVal);
                            onLoadNumWarnings++;
                        }
                        if (value > BOUNDING_BOX_RAW.maxPosVal) {
                            console.warn(
                                '%cSAML Loader (%O):%c Layer/group element %O has invalid top-left '
                                + 'vertex X value "%i" (exceeds max %i).',
                                'color: #a6cd94', this, 'color: #d5d5d5', node.elem, value,
                                BOUNDING_BOX_RAW.maxPosVal);
                            onLoadNumWarnings++;
                        }
                        rawVtces[0] = (value) * CANVAS_PIXEL_SCALE;
                    }
                    break;
                case 'lty':
                    if (type == 'layer') {
                        value = parseInt(value);
                        if (value === undefined) {
                            // Invalid Input
                            console.warn(
                                '%cSAML Loader (%O):%c Layer/group element %O has invalid top-left vertex Y value "%i".'
                                + ' Using default value (%i).',
                                'color: #a6cd94', this, 'color: #d5d5d5', node.elem, value, rawVtces[1]);
                            onLoadNumWarnings++;
                            break;
                        }
                        if (value < BOUNDING_BOX_RAW.maxNegVal) {
                            console.warn(
                                '%cSAML Loader (%O):%c Layer/group element %O has invalid top-left '
                                + 'vertex Y value "%i" (exceeds min %i).',
                                'color: #a6cd94', this, 'color: #d5d5d5', node.elem, value,
                                BOUNDING_BOX_RAW.maxNegVal);
                            onLoadNumWarnings++;
                        }
                        if (value > BOUNDING_BOX_RAW.maxPosVal) {
                            console.warn(
                                '%cSAML Loader (%O):%c Layer/group element %O has invalid top-left '
                                + 'vertex Y value "%i" (exceeds max %i).',
                                'color: #a6cd94', this, 'color: #d5d5d5', node.elem, value,
                                BOUNDING_BOX_RAW.maxPosVal);
                            onLoadNumWarnings++;
                        }
                        rawVtces[1] = (value) * CANVAS_PIXEL_SCALE;
                    }
                    break;
                case 'lbx':
                    if (type == 'layer') {
                        value = parseInt(value);
                        if (value === undefined) {
                            // Invalid Input
                            console.warn(
                                '%cSAML Loader (%O):%c Layer/group element %O has invalid bottom-left vertex X value "%i".'
                                + ' Using default value (%i).',
                                'color: #a6cd94', this, 'color: #d5d5d5', node.elem, value, rawVtces[4]);
                            onLoadNumWarnings++;
                            break;
                        }
                        if (value < BOUNDING_BOX_RAW.maxNegVal) {
                            console.warn(
                                '%cSAML Loader (%O):%c Layer/group element %O has invalid bottom-left '
                                + 'vertex X value "%i" (exceeds min %i).',
                                'color: #a6cd94', this, 'color: #d5d5d5', node.elem, value,
                                BOUNDING_BOX_RAW.maxNegVal);
                            onLoadNumWarnings++;
                        }
                        if (value > BOUNDING_BOX_RAW.maxPosVal) {
                            console.warn(
                                '%cSAML Loader (%O):%c Layer/group element %O has invalid bottom-left '
                                + 'vertex X value "%i" (exceeds max %i).',
                                'color: #a6cd94', this, 'color: #d5d5d5', node.elem, value,
                                BOUNDING_BOX_RAW.maxPosVal);
                            onLoadNumWarnings++;
                        }
                        rawVtces[4] = (value) * CANVAS_PIXEL_SCALE;
                    }
                    break;
                case 'lby':
                    if (type == 'layer') {
                        value = parseInt(value);
                        if (value === undefined) {
                            // Invalid Input
                            console.warn(
                                '%cSAML Loader (%O):%c Layer/group element %O has invalid bottom-left vertex Y value "%i".'
                                + ' Using default value (%i).',
                                'color: #a6cd94', this, 'color: #d5d5d5', node.elem, value, rawVtces[5]);
                            onLoadNumWarnings++;
                            break;
                        }
                        if (value < BOUNDING_BOX_RAW.maxNegVal) {
                            console.warn(
                                '%cSAML Loader (%O):%c Layer/group element %O has invalid bottom-left '
                                + 'vertex Y value "%i" (exceeds min %i).',
                                'color: #a6cd94', this, 'color: #d5d5d5', node.elem, value,
                                BOUNDING_BOX_RAW.maxNegVal);
                            onLoadNumWarnings++;
                        }
                        if (value > BOUNDING_BOX_RAW.maxPosVal) {
                            console.warn(
                                '%cSAML Loader (%O):%c Layer/group element %O has invalid bottom-left '
                                + 'vertex Y value "%i" (exceeds max %i).',
                                'color: #a6cd94', this, 'color: #d5d5d5', node.elem, value,
                                BOUNDING_BOX_RAW.maxPosVal);
                            onLoadNumWarnings++;
                        }
                        rawVtces[5] = (value) * CANVAS_PIXEL_SCALE;
                    }
                    break;
                case 'rtx':
                    if (type == 'layer') {
                        value = parseInt(value);
                        if (value === undefined) {
                            // Invalid Input
                            console.warn(
                                '%cSAML Loader (%O):%c Layer/group element %O has invalid top-right vertex X value "%i".'
                                + ' Using default value (%i).',
                                'color: #a6cd94', this, 'color: #d5d5d5', node.elem, value, rawVtces[2]);
                            onLoadNumWarnings++;
                            break;
                        }
                        if (value < BOUNDING_BOX_RAW.maxNegVal) {
                            console.warn(
                                '%cSAML Loader (%O):%c Layer/group element %O has invalid top-right '
                                + 'vertex X value "%i" (exceeds min %i).',
                                'color: #a6cd94', this, 'color: #d5d5d5', node.elem, value,
                                BOUNDING_BOX_RAW.maxNegVal);
                            onLoadNumWarnings++;
                        }
                        if (value > BOUNDING_BOX_RAW.maxPosVal) {
                            console.warn(
                                '%cSAML Loader (%O):%c Layer/group element %O has invalid top-right '
                                + 'vertex X value "%i" (exceeds max %i).',
                                'color: #a6cd94', this, 'color: #d5d5d5', node.elem, value,
                                BOUNDING_BOX_RAW.maxPosVal);
                            onLoadNumWarnings++;
                        }
                        rawVtces[2] = (value) * CANVAS_PIXEL_SCALE;
                    }
                    break;
                case 'rty':
                    if (type == 'layer') {
                        value = parseInt(value);
                        if (value === undefined) {
                            // Invalid Input
                            console.warn(
                                '%cSAML Loader (%O):%c Layer/group element %O has invalid top-right vertex Y value "%i".'
                                + ' Using default value (%i).',
                                'color: #a6cd94', this, 'color: #d5d5d5', node.elem, value, rawVtces[3]);
                            onLoadNumWarnings++;
                            break;
                        }
                        if (value < BOUNDING_BOX_RAW.maxNegVal) {
                            console.warn(
                                '%cSAML Loader (%O):%c Layer/group element %O has invalid top-right '
                                + 'vertex Y value "%i" (exceeds min %i).',
                                'color: #a6cd94', this, 'color: #d5d5d5', node.elem, value,
                                BOUNDING_BOX_RAW.maxNegVal);
                            onLoadNumWarnings++;
                        }
                        if (value > BOUNDING_BOX_RAW.maxPosVal) {
                            console.warn(
                                '%cSAML Loader (%O):%c Layer/group element %O has invalid top-right '
                                + 'vertex Y value "%i" (exceeds max %i).',
                                'color: #a6cd94', this, 'color: #d5d5d5', node.elem, value,
                                BOUNDING_BOX_RAW.maxPosVal);
                            onLoadNumWarnings++;
                        }
                        rawVtces[3] = (value) * CANVAS_PIXEL_SCALE;
                    }
                    break;
                case 'rbx':
                    if (type == 'layer') {
                        value = parseInt(value);
                        if (value === undefined) {
                            // Invalid Input
                            console.warn(
                                '%cSAML Loader (%O):%c Layer/group element %O has invalid bottom-right vertex X value "%i".'
                                + ' Using default value (%i).',
                                'color: #a6cd94', this, 'color: #d5d5d5', node.elem, value, rawVtces[6]);
                            onLoadNumWarnings++;
                            break;
                        }
                        if (value < BOUNDING_BOX_RAW.maxNegVal) {
                            console.warn(
                                '%cSAML Loader (%O):%c Layer/group element %O has invalid bottom-right '
                                + 'vertex X value "%i" (exceeds min %i).',
                                'color: #a6cd94', this, 'color: #d5d5d5', node.elem, value,
                                BOUNDING_BOX_RAW.maxNegVal);
                            onLoadNumWarnings++;
                        }
                        if (value > BOUNDING_BOX_RAW.maxPosVal) {
                            console.warn(
                                '%cSAML Loader (%O):%c Layer/group element %O has invalid bottom-right '
                                + 'vertex X value "%i" (exceeds max %i).',
                                'color: #a6cd94', this, 'color: #d5d5d5', node.elem, value,
                                BOUNDING_BOX_RAW.maxPosVal);
                            onLoadNumWarnings++;
                        }
                        rawVtces[6] = (value) * CANVAS_PIXEL_SCALE;
                    }
                    break;
                case 'rby':
                    if (type == 'layer') {
                        value = parseInt(value);
                        if (value === undefined) {
                            // Invalid Input
                            console.warn(
                                '%cSAML Loader (%O):%c Layer/group element %O has invalid bottom-right vertex Y value "%i".'
                                + ' Using default value (%i).',
                                'color: #a6cd94', this, 'color: #d5d5d5', node.elem, value, rawVtces[7]);
                            onLoadNumWarnings++;
                            break;
                        }
                        if (value < BOUNDING_BOX_RAW.maxNegVal) {
                            console.warn(
                                '%cSAML Loader (%O):%c Layer/group element %O has invalid bottom-right '
                                + 'vertex Y value "%i" (exceeds min %i).',
                                'color: #a6cd94', this, 'color: #d5d5d5', node.elem, value,
                                BOUNDING_BOX_RAW.maxNegVal);
                            onLoadNumWarnings++;
                        }
                        if (value > BOUNDING_BOX_RAW.maxPosVal) {
                            console.warn(
                                '%cSAML Loader (%O):%c Layer/group element %O has invalid bottom-right '
                                + 'vertex Y value "%i" (exceeds max %i).',
                                'color: #a6cd94', this, 'color: #d5d5d5', node.elem, value,
                                BOUNDING_BOX_RAW.maxPosVal);
                            onLoadNumWarnings++;
                        }
                        rawVtces[7] = (value) * CANVAS_PIXEL_SCALE;
                    }
                    break;
            }

        }
        if (rawVtces.length == 8) {
            var x = roundPosition(rawVtces[0] + rawVtces[6]) / 2;
            var y = roundPosition(rawVtces[1] + rawVtces[7]) / 2;
            node.elem.x += x; node.elem.y += y;
            for (var i = 0; i < rawVtces.length; i += 2) {
                node.elem.vertices[i] = rawVtces[i] - x;
                node.elem.vertices[i + 1] = rawVtces[i + 1] - y;
            }
            if (!isQuadAParallelogram(node.elem.vertices)) {
                console.warn(
                    '%cSAML Loader (%O):%c Layer/group element %O has an invalid shape (%O)'
                    + ' because it is not a parallelogram. '
                    + 'Top/bottom sides OR left/right sides are not equal in length.',
                    'color: #a6cd94', this, 'color: #d5d5d5', node.elem, rawVtces);
                onLoadNumWarnings++;
            }
            let invalidLens = hasQuadInvalidSideLengths(node.elem.vertices);
            if (invalidLens != null) {
                console.warn(
                    '%cSAML Loader (%O):%c Layer/group element %O has one or more invalid '
                    + 'symbol side lengths (vertices: %O, lengths: %O). '
                    + 'One or more sides exceed the max of %i. (all values scaled by %i)',
                    'color: #a6cd94', this, 'color: #d5d5d5', node.elem, rawVtces,
                    invalidLens, MAX_SYMBOL_SIDE_LEN, CANVAS_PIXEL_SCALE);
                onLoadNumWarnings++;
            }
        }
        if (type == 'layer') {
            this.editor.updateLayer(node.elem);
            this.editor.disableInteraction(node.elem);
        }

        function isQuadAParallelogram(v) {
            // Valid only if top/botom AND left/right sides are equal in length
            return (
                v[0] == -v[6] && v[1] == -v[7]
                && v[2] == -v[4] && v[3] == -v[5]
                );
        }
        function hasQuadInvalidSideLengths(v) {
            // Check if any length x or y of any side of the quad
            // has length exceeding the maximum allowed
            let lens = {
                v0_v2X: Math.abs(v[0] - v[2]),
                v1_v3Y: Math.abs(v[1] - v[3]),
                v0_v4X: Math.abs(v[0] - v[4]),
                v1_v5Y: Math.abs(v[1] - v[5]),
                v2_v6X: Math.abs(v[2] - v[6]),
                v3_v7Y: Math.abs(v[3] - v[7]),
                v4_v6X: Math.abs(v[4] - v[6]),
                v5_v7Y: Math.abs(v[5] - v[7])
            };
            if (
                // side 1
                (lens.v0_v2X > MAX_SYMBOL_SIDE_LEN)
                || (lens.v1_v3Y > MAX_SYMBOL_SIDE_LEN)
                // side 2
                || (lens.v0_v4X > MAX_SYMBOL_SIDE_LEN)
                || (lens.v1_v5Y > MAX_SYMBOL_SIDE_LEN)
                // side 3
                || (lens.v2_v6X > MAX_SYMBOL_SIDE_LEN)
                || (lens.v3_v7Y > MAX_SYMBOL_SIDE_LEN)
                // side 4
                || (lens.v4_v6X > MAX_SYMBOL_SIDE_LEN)
                || (lens.v5_v7Y > MAX_SYMBOL_SIDE_LEN)
                ) {
                return lens;
            }
            else {
                return null;
            }
        }
        function hexToRgb(hex) {
            var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : null;
        }
        function rgbToHex(color) {
            return componentToHex(color.r) + componentToHex(color.g) + componentToHex(color.b);
        }
        function componentToHex(c) {
            var hex = c.toString(16);
            return hex.length == 1 ? "0" + hex : hex;
        }
    },
    setupOverlay: function (xml) {
        let tags = xml.match(/<overlay-img>|<overlay-img [^\n]*>/);
        if (tags == null || tags.length <= 0) return;
        var keyValues = tags[0].match(/([A-Z|a-z][A-Z|a-z|0-9|_]*[A-Z|a-z|0-9|-]*="[^"|\n]+")+/g);
        let overlay = $('canvas')[0].editor.overlayImg;
        for (var i = 0; i < keyValues.length; i++) {
            let keyValue = keyValues[i];
            let key = keyValue.substr(0, keyValue.indexOf('='));
            let value = keyValue.substr(keyValue.indexOf('=') + 1).match(/([^"|\n]+)/)[0].trim();

            switch (key) {
                case 'src':
                    let base64Pattern = /^data:image\/(jpg|jpeg|tiff|png|bmp);base64,([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=)|([0-9a-zA-Z+/]{3}))?$/;
                    if (!base64Pattern.test(value)) {
                        // Invalid Input
                        console.warn(
                            '%cSAML Loader (%O):%c Overlay Image has invalid source "%s".',
                            'color: #a6cd94', this, 'color: #d5d5d5', value);
                        onLoadNumWarnings++;
                        break;
                    }
                    overlay.setImage(value);
                    break;
                case 'pos-x':
                    value = parseFloat(value);
                    if (value === undefined) {
                        // Invalid Input
                        console.warn(
                            '%cSAML Loader (%O):%c Overlay Image has invalid pos-x value "%i".'
                            + ' Using default value (%i).',
                            'color: #a6cd94', this, 'color: #d5d5d5', value, overlay.getImage().x);
                        onLoadNumWarnings++;
                        break;
                    }
                    overlay.moveToX(value);
                    break;
                case 'pos-y':
                    value = parseFloat(value);
                    if (value === undefined) {
                        // Invalid Input
                        console.warn(
                            '%cSAML Loader (%O):%c Overlay Image %O has invalid pos-y value "%i".'
                            + ' Using default value (%i).',
                            'color: #a6cd94', this, 'color: #d5d5d5', value, overlay.getImage().y);
                        onLoadNumWarnings++;
                        break;
                    }
                    overlay.moveToY(value);
                    break;
                case 'scale':
                    value = parseFloat(value);
                    if (value === undefined) {
                        // Invalid Input
                        console.warn(
                            '%cSAML Loader (%O):%c Overlay Image %O has invalid scale "%i".'
                            + ' Using default value (%i).',
                            'color: #a6cd94', this, 'color: #d5d5d5', value, overlay.getImage().scale.x);
                        onLoadNumWarnings++;
                        break;
                    }
                    overlay.scale(value);
                    break;
                case 'rot':
                    value = parseFloat(value);
                    if (value === undefined) {
                        // Invalid Input
                        console.warn(
                            '%cSAML Loader (%O):%c Overlay Image %O has invalid scale "%i".'
                            + ' Using default value (%i).',
                            'color: #a6cd94', this, 'color: #d5d5d5', value, overlay.getImage().rotation);
                        onLoadNumWarnings++;
                        break;
                    }
                    overlay.rotate(value);
                    break;
                case 'alpha':
                    value = parseFloat(value);
                    if (value === undefined) {
                        // Invalid Input
                        console.warn(
                            '%cSAML Loader (%O):%c Overlay Image %O has invalid transparency "%i".'
                            + ' Using default value (%i).',
                            'color: #a6cd94', this, 'color: #d5d5d5', value, overlay.getImage().alpha);
                        onLoadNumWarnings++;
                        break;
                    }
                    overlay.transparency(value);
                    break;
                case 'green-screen':
                    if (value === undefined
                        || (value !== 'true' && value !== 'false')) {
                        // Invalid Input
                        console.warn(
                            '%cSAML Loader (%O):%c Overlay Image %O has invalid green-screen value "%o".'
                            + ' Using default value (%o).',
                            'color: #a6cd94', this, 'color: #d5d5d5', value, false);
                        onLoadNumWarnings++;
                        break;
                    }
                    if (value === 'true') value = true;
                    else if (value === 'false') value = false;

                    if (value)
                        overlay.backgroundInfo.DOM.domElement.click();
                    break;
            }
        }

        editorToolbar.enableOptionInTool(1, 'overlay');
    }
});