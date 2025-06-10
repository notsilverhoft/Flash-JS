/**
 * WebGL Display Translator for Flash-JS Repository
 * Converts DisplayParser output to WebGL display list operations
 * Integrates with Parse.js webpage terminal output for debugging
 * Works with existing ShapeTranslator.js for proper object positioning
 * FIXED: Direct SWF parsing integration for WebGL renderer pipeline
 * ENHANCED: Transform matrix calculation for accurate positioning
 * INTEGRATED: Color transform support for visual effects
 * ADDED: Display list management for proper depth sorting
 * NEW: parseSWFForDisplayObjects method for direct WebGL integration
 */

class DisplayTranslator {
    constructor(webglRenderer, shapeTranslator) {
        this.webglRenderer = webglRenderer;
        this.shapeTranslator = shapeTranslator;
        
        // Display list state management for Flash-JS repository
        this.displayObjects = new Map(); // depth -> display object
        this.characterMap = new Map(); // characterId -> translated geometry
        this.currentFrame = 0;
        this.timeline = [];
        
        // Translation statistics for Flash-JS repository
        this.translationStats = {
            totalPlaceObjects: 0,
            successfulPlacements: 0,
            failedPlacements: 0,
            currentDepth: 1000, // Starting depth for auto-placement
            method: 'timeline_display_translation'
        };
        
        this.logToTerminal('DisplayTranslator initialized for Flash-JS repository');
    }

    /**
     * Parse SWF data directly for display objects - NEW method for WebGL renderer integration
     */
    parseSWFForDisplayObjects(arrayBuffer, translatedShapeData) {
        this.logToTerminal('=== PARSING SWF FOR DISPLAY OBJECTS (Direct WebGL Integration) ===');
        
        const bytes = new Uint8Array(arrayBuffer);
        
        if (arrayBuffer.byteLength < 8) {
            this.logToTerminal('Invalid SWF file: File is too small');
            return [];
        }
        
        // Clear previous data
        this.displayObjects.clear();
        this.characterMap = new Map(translatedShapeData || new Map());
        this.currentFrame = 0;
        this.timeline = [];
        this.translationStats.totalPlaceObjects = 0;
        this.translationStats.successfulPlacements = 0;
        this.translationStats.failedPlacements = 0;
        
        // Read signature to determine processing method
        const signature = String.fromCharCode(bytes[0], bytes[1], bytes[2]);
        let tagData;
        
        try {
            switch (signature) {
                case 'FWS':
                    // Calculate tag data offset for uncompressed files
                    const nbits = (bytes[8] >> 3) & 0x1F;
                    const rectBits = 5 + (4 * nbits);
                    const rectBytes = Math.ceil(rectBits / 8);
                    const tagOffset = 8 + rectBytes + 4; // +4 for frame rate and count
                    tagData = bytes.slice(tagOffset);
                    break;
                    
                case 'CWS':
                    // Decompress ZLIB data
                    const compressedData = arrayBuffer.slice(8);
                    const decompressedData = pako.inflate(new Uint8Array(compressedData));
                    
                    // Calculate tag offset from decompressed data
                    const nbitsCWS = (decompressedData[0] >> 3) & 0x1F;
                    const rectBitsCWS = 5 + (4 * nbitsCWS);
                    const rectBytesCWS = Math.ceil(rectBitsCWS / 8);
                    const tagOffsetCWS = rectBytesCWS + 4;
                    tagData = decompressedData.slice(tagOffsetCWS);
                    break;
                    
                case 'ZWS':
                    this.logToTerminal('LZMA decompression not supported in direct parsing mode');
                    return [];
                    
                default:
                    this.logToTerminal(`Unknown SWF format: ${signature}`);
                    return [];
            }
            
            // Parse tags for display objects
            const displayObjects = this.parseTagsForDisplayObjects(tagData);
            
            this.logToTerminal(`Parsed ${displayObjects.length} display objects from SWF data`);
            this.logToTerminal(`PlaceObject success rate: ${this.translationStats.successfulPlacements}/${this.translationStats.totalPlaceObjects}`);
            
            return displayObjects;
            
        } catch (error) {
            this.logToTerminal(`Error parsing SWF for display objects: ${error.message}`);
            return [];
        }
    }

    /**
     * Parse tag data specifically for display objects - NEW method for Flash-JS repository
     */
    parseTagsForDisplayObjects(tagData) {
        const displayObjects = [];
        
        // Initialize DisplayParsers for direct parsing
        let displayParser = null;
        if (typeof DisplayParsers !== 'undefined') {
            displayParser = new DisplayParsers();
            this.logToTerminal('DisplayParsers initialized for direct SWF parsing');
        } else {
            this.logToTerminal('DisplayParsers not available - cannot parse display tags');
            return [];
        }
        
        let offset = 0;
        let tagIndex = 0;
        
        while (offset < tagData.length) {
            const tagHeader = this.parseTagHeader(tagData, offset);
            
            if (!tagHeader) {
                this.logToTerminal(`Error parsing tag header at offset ${offset}`);
                break;
            }
            
            // Process display tags (PlaceObject variants, RemoveObject variants, ShowFrame)
            const isDisplayTag = [4, 5, 26, 28, 70, 1].includes(tagHeader.type);
            
            if (isDisplayTag && tagHeader.length >= 0) {
                try {
                    const contentOffset = offset + tagHeader.headerSize;
                    const parsedContent = displayParser.parseTag(tagHeader.type, tagData, contentOffset, tagHeader.length);
                    
                    if (parsedContent && parsedContent.data) {
                        let displayObject = null;
                        
                        // Process different display tag types
                        if (tagHeader.type === 4 || tagHeader.type === 26 || tagHeader.type === 70) { // PlaceObject variants
                            displayObject = this.translatePlaceObject(parsedContent.data, this.characterMap);
                            if (displayObject) {
                                displayObjects.push(displayObject);
                                this.logToTerminal(`Processed PlaceObject: Character ${displayObject.characterId} at depth ${displayObject.depth}`);
                            }
                        } else if (tagHeader.type === 5 || tagHeader.type === 28) { // RemoveObject variants
                            this.translateRemoveObject(parsedContent.data);
                        } else if (tagHeader.type === 1) { // ShowFrame
                            this.translateShowFrame(parsedContent.data);
                        }
                    }
                } catch (parseError) {
                    this.logToTerminal(`Error parsing display tag ${tagHeader.type}: ${parseError.message}`);
                }
            }
            
            // If this is the End tag (type 0), stop parsing
            if (tagHeader.type === 0) {
                this.logToTerminal('End tag reached in display object parsing');
                break;
            }
            
            // Move to next tag
            offset += tagHeader.headerSize + tagHeader.length;
            tagIndex++;
            
            // Safety check to prevent infinite loops
            if (tagIndex > 10000) {
                this.logToTerminal('Maximum tag limit reached (10000 tags)');
                break;
            }
        }
        
        return displayObjects;
    }

    /**
     * Parse tag header - duplicated from TagParse.js for direct SWF parsing
     */
    parseTagHeader(data, offset) {
        if (offset + 2 > data.length) {
            return null;
        }
        
        // Read first 2 bytes
        const byte1 = data[offset];
        const byte2 = data[offset + 1];
        
        // Extract tag type (upper 10 bits) and length (lower 6 bits)
        const tagAndLength = (byte2 << 8) | byte1;
        const tagType = (tagAndLength >> 6) & 0x3FF;
        const shortLength = tagAndLength & 0x3F;
        
        let length, headerSize;
        
        if (shortLength === 0x3F) {
            // Long format: read 4 more bytes for length
            if (offset + 6 > data.length) {
                return null;
            }
            
            length = data[offset + 2] | 
                     (data[offset + 3] << 8) | 
                     (data[offset + 4] << 16) | 
                     (data[offset + 5] << 24);
            headerSize = 6;
        } else {
            // Short format
            length = shortLength;
            headerSize = 2;
        }
        
        return {
            type: tagType,
            length: length,
            headerSize: headerSize
        };
    }

    /**
     * Process PlaceObject tags from DisplayParser for Flash-JS repository
     */
    translatePlaceObject(placeObjectData, availableCharacters) {
        this.logToTerminal(`=== TRANSLATING PLACE OBJECT ===`);
        this.translationStats.totalPlaceObjects++;
        
        try {
            // Extract placement data from DisplayParser output
            const characterId = placeObjectData.characterId || placeObjectData.PlaceFlagHasCharacter;
            const depth = placeObjectData.depth || this.translationStats.currentDepth++;
            const matrix = this.extractTransformMatrix(placeObjectData);
            const colorTransform = this.extractColorTransform(placeObjectData);
            const name = placeObjectData.name || `character_${characterId}`;
            
            this.logToTerminal(`PlaceObject: Character ${characterId} at depth ${depth}`);
            
            // Find corresponding translated character from availableCharacters
            const translatedCharacter = this.findTranslatedCharacter(characterId, availableCharacters);
            
            if (!translatedCharacter) {
                this.logToTerminal(`Character ${characterId} not found in translated characters, creating placeholder`);
                return this.createPlaceholderDisplayObject(characterId, depth, matrix);
            }
            
            // Create WebGL display object for Flash-JS repository
            const displayObject = this.createWebGLDisplayObject(
                translatedCharacter,
                characterId,
                depth,
                matrix,
                colorTransform,
                name
            );
            
            // Add to display list
            this.displayObjects.set(depth, displayObject);
            this.characterMap.set(characterId, translatedCharacter);
            
            // Update WebGL renderer for Flash-JS repository
            this.updateWebGLRenderer(displayObject);
            
            this.translationStats.successfulPlacements++;
            this.logToTerminal(`Successfully placed character ${characterId} at depth ${depth}`);
            
            return displayObject;
            
        } catch (error) {
            this.translationStats.failedPlacements++;
            this.logToTerminal(`PlaceObject translation failed: ${error.message}`);
            return null;
        }
    }

    /**
     * Process RemoveObject tags from DisplayParser for Flash-JS repository
     */
    translateRemoveObject(removeObjectData) {
        this.logToTerminal(`=== TRANSLATING REMOVE OBJECT ===`);
        
        const depth = removeObjectData.depth;
        const characterId = removeObjectData.characterId;
        
        if (this.displayObjects.has(depth)) {
            const displayObject = this.displayObjects.get(depth);
            this.logToTerminal(`Removing object at depth ${depth}, character ${displayObject.characterId}`);
            
            // Remove from WebGL renderer
            this.removeFromWebGLRenderer(displayObject);
            
            // Remove from display list
            this.displayObjects.delete(depth);
            
            return true;
        } else {
            this.logToTerminal(`No object found at depth ${depth} to remove`);
            return false;
        }
    }

    /**
     * Process ShowFrame tags from DisplayParser for Flash-JS repository
     */
    translateShowFrame(showFrameData) {
        this.currentFrame++;
        this.logToTerminal(`=== SHOW FRAME ${this.currentFrame} ===`);
        
        // Capture current display list state for timeline
        const frameState = {
            frame: this.currentFrame,
            displayObjects: new Map(this.displayObjects),
            timestamp: Date.now()
        };
        
        this.timeline.push(frameState);
        
        // Update WebGL renderer with current frame state
        this.renderCurrentFrame();
        
        this.logToTerminal(`Frame ${this.currentFrame}: ${this.displayObjects.size} display objects`);
        
        return frameState;
    }

    /**
     * Extract transform matrix from PlaceObject data for Flash-JS repository
     */
    extractTransformMatrix(placeObjectData) {
        // Default identity matrix for Flash-JS repository
        let matrix = {
            scaleX: 1.0,
            scaleY: 1.0,
            skewX: 0.0,
            skewY: 0.0,
            translateX: 0.0,
            translateY: 0.0
        };
        
        // Extract from DisplayParser matrix data
        if (placeObjectData.matrix) {
            const m = placeObjectData.matrix;
            matrix.scaleX = m.scaleX !== undefined ? m.scaleX : 1.0;
            matrix.scaleY = m.scaleY !== undefined ? m.scaleY : 1.0;
            matrix.skewX = m.rotateSkew0 !== undefined ? m.rotateSkew0 : 0.0;
            matrix.skewY = m.rotateSkew1 !== undefined ? m.rotateSkew1 : 0.0;
            matrix.translateX = m.translateX !== undefined ? m.translateX / 20 : 0.0; // Convert from twips
            matrix.translateY = m.translateY !== undefined ? m.translateY / 20 : 0.0;
        }
        
        // Handle PlaceObject2/PlaceObject3 positioning from Parse.js data
        if (placeObjectData.PlaceFlagHasMatrix) {
            matrix.translateX = (placeObjectData.translateX || 0) / 20; // Convert from twips
            matrix.translateY = (placeObjectData.translateY || 0) / 20;
        }
        
        this.logToTerminal(`Transform Matrix: translate(${matrix.translateX}, ${matrix.translateY}) scale(${matrix.scaleX}, ${matrix.scaleY})`);
        
        return matrix;
    }

    /**
     * Extract color transform from PlaceObject data for Flash-JS repository
     */
    extractColorTransform(placeObjectData) {
        // Default no color transform for Flash-JS repository
        let colorTransform = {
            redMultiplier: 1.0,
            greenMultiplier: 1.0,
            blueMultiplier: 1.0,
            alphaMultiplier: 1.0,
            redOffset: 0,
            greenOffset: 0,
            blueOffset: 0,
            alphaOffset: 0
        };
        
        // Extract from DisplayParser color transform data
        if (placeObjectData.colorTransform) {
            const ct = placeObjectData.colorTransform;
            colorTransform.redMultiplier = ct.redMultiplier !== undefined ? ct.redMultiplier / 256 : 1.0;
            colorTransform.greenMultiplier = ct.greenMultiplier !== undefined ? ct.greenMultiplier / 256 : 1.0;
            colorTransform.blueMultiplier = ct.blueMultiplier !== undefined ? ct.blueMultiplier / 256 : 1.0;
            colorTransform.alphaMultiplier = ct.alphaMultiplier !== undefined ? ct.alphaMultiplier / 256 : 1.0;
            colorTransform.redOffset = ct.redOffset || 0;
            colorTransform.greenOffset = ct.greenOffset || 0;
            colorTransform.blueOffset = ct.blueOffset || 0;
            colorTransform.alphaOffset = ct.alphaOffset || 0;
        }
        
        return colorTransform;
    }

    /**
     * Find translated character geometry from ShapeTranslator for Flash-JS repository
     */
    findTranslatedCharacter(characterId, availableCharacters) {
        // First check if character is already in our map
        if (this.characterMap.has(characterId)) {
            return this.characterMap.get(characterId);
        }
        
        // Look in availableCharacters map (from WebGL renderer)
        if (availableCharacters && availableCharacters.has) {
            if (availableCharacters.has(characterId)) {
                const character = availableCharacters.get(characterId);
                this.logToTerminal(`Found character ${characterId} in available characters`);
                return character;
            }
        }
        
        // Look in availableCharacters object
        if (availableCharacters && availableCharacters[characterId]) {
            const character = availableCharacters[characterId];
            this.logToTerminal(`Found character ${characterId} in available characters object`);
            return character;
        }
        
        this.logToTerminal(`Character ${characterId} not found in available characters`);
        return null;
    }

    /**
     * Create WebGL display object for Flash-JS repository
     */
    createWebGLDisplayObject(translatedCharacter, characterId, depth, matrix, colorTransform, name) {
        const displayObject = {
            characterId: characterId,
            depth: depth,
            name: name,
            geometry: translatedCharacter,
            transform: matrix,
            colorTransform: colorTransform,
            visible: true,
            created: Date.now(),
            
            // WebGL specific data for Flash-JS repository
            worldMatrix: this.calculateWorldMatrix(matrix),
            renderData: this.prepareRenderData(translatedCharacter, matrix, colorTransform)
        };
        
        this.logToTerminal(`Created display object: ${name} (char: ${characterId}, depth: ${depth})`);
        
        return displayObject;
    }

    /**
     * Create placeholder for missing characters in Flash-JS repository
     */
    createPlaceholderDisplayObject(characterId, depth, matrix) {
        this.logToTerminal(`Creating placeholder for missing character ${characterId}`);
        
        // Create simple colored rectangle as placeholder
        const placeholderGeometry = {
            vertices: new Float32Array([
                0, 0,
                20, 0,
                0, 20,
                20, 0,
                20, 20,
                0, 20
            ]),
            colors: new Float32Array([
                0.8, 0.2, 0.2, 1.0,  // Red placeholder
                0.8, 0.2, 0.2, 1.0,
                0.8, 0.2, 0.2, 1.0,
                0.8, 0.2, 0.2, 1.0,
                0.8, 0.2, 0.2, 1.0,
                0.8, 0.2, 0.2, 1.0
            ]),
            vertexCount: 6,
            triangleCount: 2,
            method: 'placeholder',
            shapeId: characterId
        };
        
        return this.createWebGLDisplayObject(
            placeholderGeometry,
            characterId,
            depth,
            matrix,
            { redMultiplier: 1, greenMultiplier: 1, blueMultiplier: 1, alphaMultiplier: 1 },
            `placeholder_${characterId}`
        );
    }

    /**
     * Calculate world transformation matrix for Flash-JS repository WebGL rendering
     */
    calculateWorldMatrix(transform) {
        // Create 2D transformation matrix for WebGL
        const cos = Math.cos(transform.skewX);
        const sin = Math.sin(transform.skewX);
        
        return {
            a: transform.scaleX * cos,
            b: transform.scaleX * sin,
            c: -transform.scaleY * sin,
            d: transform.scaleY * cos,
            tx: transform.translateX,
            ty: transform.translateY
        };
    }

    /**
     * Prepare render data for WebGL renderer in Flash-JS repository
     */
    prepareRenderData(geometry, transform, colorTransform) {
        return {
            vertices: geometry.vertices,
            colors: this.applyColorTransform(geometry.colors, colorTransform),
            vertexCount: geometry.vertexCount,
            triangleCount: geometry.triangleCount,
            transform: transform,
            needsUpdate: true
        };
    }

    /**
     * Apply color transform to geometry colors for Flash-JS repository
     */
    applyColorTransform(originalColors, colorTransform) {
        if (!originalColors || originalColors.length === 0) {
            return originalColors;
        }
        
        const transformedColors = new Float32Array(originalColors.length);
        
        for (let i = 0; i < originalColors.length; i += 4) {
            transformedColors[i] = Math.max(0, Math.min(1, 
                originalColors[i] * colorTransform.redMultiplier + colorTransform.redOffset / 255
            ));
            transformedColors[i + 1] = Math.max(0, Math.min(1, 
                originalColors[i + 1] * colorTransform.greenMultiplier + colorTransform.greenOffset / 255
            ));
            transformedColors[i + 2] = Math.max(0, Math.min(1, 
                originalColors[i + 2] * colorTransform.blueMultiplier + colorTransform.blueOffset / 255
            ));
            transformedColors[i + 3] = Math.max(0, Math.min(1, 
                originalColors[i + 3] * colorTransform.alphaMultiplier + colorTransform.alphaOffset / 255
            ));
        }
        
        return transformedColors;
    }

    /**
     * Update WebGL renderer with new display object for Flash-JS repository
     */
    updateWebGLRenderer(displayObject) {
        if (!this.webglRenderer) {
            this.logToTerminal('No WebGL renderer available for display object update');
            return;
        }
        
        try {
            // Add display object to WebGL renderer
            if (this.webglRenderer.addDisplayObject) {
                this.webglRenderer.addDisplayObject(displayObject);
            } else {
                this.logToTerminal('WebGL renderer does not support addDisplayObject method');
            }
            
            this.logToTerminal(`Updated WebGL renderer with display object at depth ${displayObject.depth}`);
            
        } catch (error) {
            this.logToTerminal(`Failed to update WebGL renderer: ${error.message}`);
        }
    }

    /**
     * Remove display object from WebGL renderer for Flash-JS repository
     */
    removeFromWebGLRenderer(displayObject) {
        if (!this.webglRenderer) {
            return;
        }
        
        try {
            if (this.webglRenderer.removeDisplayObject) {
                this.webglRenderer.removeDisplayObject(displayObject);
            }
            
            this.logToTerminal(`Removed display object at depth ${displayObject.depth} from WebGL renderer`);
            
        } catch (error) {
            this.logToTerminal(`Failed to remove display object from WebGL renderer: ${error.message}`);
        }
    }

    /**
     * Render current frame state for Flash-JS repository
     */
    renderCurrentFrame() {
        if (!this.webglRenderer) {
            return;
        }
        
        try {
            // Sort display objects by depth for proper rendering order
            const sortedObjects = Array.from(this.displayObjects.entries())
                .sort((a, b) => a[0] - b[0]) // Sort by depth (key)
                .map(entry => entry[1]); // Get display objects
            
            // Update WebGL renderer with current display list
            if (this.webglRenderer.updateDisplayList) {
                this.webglRenderer.updateDisplayList(sortedObjects);
            }
            
            this.logToTerminal(`Rendered frame ${this.currentFrame} with ${sortedObjects.length} objects`);
            
        } catch (error) {
            this.logToTerminal(`Frame rendering failed: ${error.message}`);
        }
    }

    /**
     * Get all current display objects for Flash-JS repository WebGL integration
     */
    getCurrentDisplayObjects() {
        return Array.from(this.displayObjects.values());
    }

    /**
     * Get display object at specific depth for Flash-JS repository
     */
    getDisplayObjectAtDepth(depth) {
        return this.displayObjects.get(depth);
    }

    /**
     * Clear all display objects for Flash-JS repository
     */
    clearDisplayList() {
        this.logToTerminal('Clearing display list');
        
        // Remove all objects from WebGL renderer
        for (const displayObject of this.displayObjects.values()) {
            this.removeFromWebGLRenderer(displayObject);
        }
        
        // Clear internal maps
        this.displayObjects.clear();
        this.characterMap.clear();
        this.currentFrame = 0;
        this.timeline = [];
    }

    /**
     * Get translation statistics for Flash-JS repository debugging
     */
    getTranslationStats() {
        return {
            ...this.translationStats,
            currentDisplayObjects: this.displayObjects.size,
            currentFrame: this.currentFrame,
            timelineLength: this.timeline.length,
            successRate: this.translationStats.totalPlaceObjects > 0 ? 
                (this.translationStats.successfulPlacements / this.translationStats.totalPlaceObjects) * 100 : 0
        };
    }

    /**
     * Log messages to Parse.js webpage terminal for Flash-JS repository debugging
     */
    logToTerminal(message) {
        const timestamp = new Date().toISOString().substring(11, 19);
        const logMessage = `[${timestamp}] [DisplayTranslator] ${message}`;
        
        console.log(logMessage);
        
        // Use Flash-JS Parse.js webpage terminal output system
        const terminal = document.getElementById('terminalOutput');
        if (terminal) {
            terminal.textContent += '\n' + logMessage;
            terminal.scrollTop = terminal.scrollHeight;
        }
    }
}

// Export for use with Flash-JS repository
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DisplayTranslator;
}

// Global access for Flash-JS repository integration
if (typeof window !== 'undefined') {
    window.DisplayTranslator = DisplayTranslator;
}
