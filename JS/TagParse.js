/* 
 * SWF Tag Parser - v3.3
 * Supports:
 * - Tag header parsing (type and length)
 * - Short and long format tag headers
 * - FWS, CWS, and ZWS formats
 * - Tag names and unknown tag detection
 * - Filter for important tags only
 * - Content parsing mode (shows ONLY parsed content)
 * - Unparsed content mode (shows ONLY tags that can't be parsed)
 * - Error-only mode (shows ONLY tags with parsing errors)
 * - FIXED: Stack overflow in content formatting
 * - ADDED: Font parsing support
 * - ADDED: Text parsing support
 * - ADDED: Bitmap parsing support
 * - ADDED: Sound parsing support
 * - ADDED: Button parsing support
 * - ADDED: Video parsing support
 * - ADDED: Morph shape parsing support
 * - ADDED: ActionScript tag filtering support
 * - ADDED: Tag type filtering for large SWF files
 * - FIXED: Tag filters persisting across modes
 * - ADDED: Tag type filtering for error mode
 * - ENHANCED: Added PlaceObject3 support (Tag 70)
 * - ADDED: Scaling grid parsing support (Tag 78)
 * - ENHANCED: Added AS3Parsers integration for comprehensive ActionScript 3.0 support
 * - ENHANCED: Automatic translator implementation for real-time translation
 * - ENHANCED: WebGL renderer integration for complete rendering pipeline
 */

// Global variables for tag filtering
window.showAllTags = false;
window.showContentParsing = false;
window.showUnparsedOnly = false;
window.showErrorsOnly = false;
window.tagTypeFilter = null; // Tag type filtering

// Tag name mapping
const tagNames = {
  0: "End",
  1: "ShowFrame",
  2: "DefineShape",
  4: "PlaceObject",
  5: "RemoveObject",
  6: "DefineBits",
  7: "DefineButton",
  8: "JPEGTables",
  9: "SetBackgroundColor",
  10: "DefineFont",
  11: "DefineText",
  12: "DoAction",
  13: "DefineFontInfo",
  14: "DefineSound",
  15: "StartSound",
  17: "DefineButtonSound",
  18: "SoundStreamHead",
  19: "SoundStreamBlock",
  20: "DefineBitsLossless",
  21: "DefineBitsJPEG2",
  22: "DefineShape2",
  23: "DefineButtonCxform",
  24: "Protect",
  25: "PathsArePostScript",
  26: "PlaceObject2",
  28: "RemoveObject2",
  32: "DefineShape3",
  33: "DefineText2",
  34: "DefineButton2",
  35: "DefineBitsJPEG3",
  36: "DefineBitsLossless2",
  37: "DefineEditText",
  39: "DefineSprite",
  43: "FrameLabel",
  45: "SoundStreamHead2",
  46: "DefineMorphShape",
  48: "DefineFont2",
  56: "ExportAssets",
  57: "ImportAssets",
  58: "EnableDebugger",
  59: "DoInitAction",
  60: "DefineVideoStream",
  61: "VideoFrame",
  62: "DefineFontInfo2",
  64: "EnableDebugger2",
  65: "ScriptLimits",
  66: "SetTabIndex",
  69: "FileAttributes",
  70: "PlaceObject3",
  71: "ImportAssets2",
  73: "DefineFontAlignZones",
  74: "CSMTextSettings",
  75: "DefineFont3",
  76: "SymbolClass",
  77: "Metadata",
  78: "DefineScalingGrid",
  82: "DoABC",
  83: "DefineShape4",
  84: "DefineMorphShape2",
  86: "DefineSceneAndFrameLabelData",
  87: "DefineBinaryData",
  88: "DefineFontName",
  90: "DefineFont4"
};

// Important tags that should always be shown
const importantTags = new Set([
  0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 17, 18, 19, 20, 21, 22, 23, 24, 26, 28, 32, 33, 34, 35, 36, 37, 39, 43, 45, 46, 48, 56, 57, 59, 60, 61, 69, 70, 75, 76, 77, 78, 82, 83, 84, 86, 90
]);

// Control tags that can be parsed for content
const controlTags = new Set([
  0, 1, 9, 24, 43, 69, 77, 86
]);

// Display tags that can be parsed for content
const displayTags = new Set([
  4, 5, 26, 28, 70
]);

// Asset tags that can be parsed for content
const assetTags = new Set([
  56, 57, 71, 76
]);

// ActionScript tags that can be parsed for content
const actionscriptTags = new Set([
  12, 59, 82
]);

// Shape tags that can be parsed for content
const shapeTags = new Set([
  2, 22, 32, 83
]);

// Sprite tags that can be parsed for content
const spriteTags = new Set([
  39
]);

// Font tags that can be parsed for content
const fontTags = new Set([
  10, 13, 48, 62, 73, 75, 88, 90
]);

// Text tags that can be parsed for content
const textTags = new Set([
  11, 33, 37
]);

// Bitmap tags that can be parsed for content
const bitmapTags = new Set([
  6, 8, 20, 21, 35, 36
]);

// Sound tags that can be parsed for content
const soundTags = new Set([
  14, 15, 17, 18, 19, 45
]);

// Button tags that can be parsed for content
const buttonTags = new Set([
  7, 23, 34
]);

// Video tags that can be parsed for content
const videoTags = new Set([
  60, 61
]);

// Morph shape tags that can be parsed for content
const morphTags = new Set([
  46, 84
]);

// Scaling tags that can be parsed for content
const scalingTags = new Set([
  78
]);

// Function to check if tag should be displayed based on filter
function shouldDisplayTagByFilter(tagType) {
  // Only apply tag type filters when in content parsing mode or error mode
  if ((!window.showContentParsing && !window.showErrorsOnly) || !window.tagTypeFilter) {
    return true; // No filter, show all
  }
  
  if (window.tagTypeFilter.type === 'specific') {
    return tagType === window.tagTypeFilter.tagType;
  } else if (window.tagTypeFilter.type === 'category') {
    const category = window.tagTypeFilter.category;
    switch (category) {
      case 'control':
        return controlTags.has(tagType);
      case 'display':
        return displayTags.has(tagType);
      case 'asset':
        return assetTags.has(tagType);
      case 'actionscript':
        return actionscriptTags.has(tagType);
      case 'shape':
        return shapeTags.has(tagType);
      case 'sprite':
        return spriteTags.has(tagType);
      case 'font':
        return fontTags.has(tagType);
      case 'text':
        return textTags.has(tagType);
      case 'bitmap':
        return bitmapTags.has(tagType);
      case 'sound':
        return soundTags.has(tagType);
      case 'button':
        return buttonTags.has(tagType);
      case 'video':
        return videoTags.has(tagType);
      case 'morph':
        return morphTags.has(tagType);
      case 'scaling':
        return scalingTags.has(tagType);
      default:
        return true;
    }
  }
  
  return true;
}

function parseSWFTags(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const output = [];
  
  if (arrayBuffer.byteLength < 8) {
    output.push("Invalid SWF file: File is too small");
    return output.join('\n');
  }
  
  // Read signature to determine processing method
  const signature = String.fromCharCode(bytes[0], bytes[1], bytes[2]);
  let tagData;
  
  try {
    switch (signature) {
      case 'FWS':
        // Calculate tag data offset for uncompressed files
        const rect = parseRECT(bytes, 8);
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
        const rectCWS = parseRECT(decompressedData, 0);
        const nbitsCWS = (decompressedData[0] >> 3) & 0x1F;
        const rectBitsCWS = 5 + (4 * nbitsCWS);
        const rectBytesCWS = Math.ceil(rectBitsCWS / 8);
        const tagOffsetCWS = rectBytesCWS + 4;
        tagData = decompressedData.slice(tagOffsetCWS);
        break;
        
      case 'ZWS':
        // Verify LZMA library is loaded
        if (typeof LZMA === 'undefined') {
          output.push("Error: LZMA library is not loaded.");
          return output.join('\n');
        }
        
        if (!LZMA.decompress) {
          output.push("Error: LZMA library loaded but decompress method not found.");
          return output.join('\n');
        }
        
        // Extract the uncompressed length (bytes 8-12, little endian)
        const dataView = new DataView(arrayBuffer);
        const uncompressedLength = dataView.getUint32(8, true);
        
        // Prepare the LZMA data
        const lzmaData = new Uint8Array(5 + 8 + (arrayBuffer.byteLength - 17));
        lzmaData.set(bytes.slice(12, 17), 0);
        
        // Set uncompressed size (8 bytes, little endian)
        for (let i = 0; i < 8; i++) {
          if (i < 4) {
            lzmaData[5 + i] = (uncompressedLength >> (i * 8)) & 0xFF;
          } else {
            lzmaData[5 + i] = 0;
          }
        }
        
        lzmaData.set(bytes.slice(17), 13);
        
        output.push("Starting LZMA decompression for tag parsing...");
        
        // Use async LZMA decompression
        LZMA.decompress(lzmaData, function(result, error) {
          if (error) {
            const errorMessage = `LZMA decompression failed: ${error}`;
            output.push(errorMessage);
            document.getElementById('terminalOutput').textContent = output.join('\n');
            return;
          }
          
          const decompressedData = new Uint8Array(result);
          
          try {
            // Calculate tag offset from decompressed data
            const rectZWS = parseRECT(decompressedData, 0);
            const nbitsZWS = (decompressedData[0] >> 3) & 0x1F;
            const rectBitsZWS = 5 + (4 * nbitsZWS);
            const rectBytesZWS = Math.ceil(rectBitsZWS / 8);
            const tagOffsetZWS = rectBytesZWS + 4;
            tagData = decompressedData.slice(tagOffsetZWS);
            
            output.push("LZMA decompression successful.");
            
            const tagResults = parseTagData(tagData);
            output.push(...tagResults);
            
          } catch (rectError) {
            output.push(`Error parsing LZMA decompressed data: ${rectError.message}`);
          }
          
          // Update terminal with complete output
          document.getElementById('terminalOutput').textContent = output.join('\n');
        });
        
        output.push("LZMA decompression started. Please wait...");
        return output.join('\n');
        
      default:
        output.push(`Unknown SWF format: ${signature}`);
        return output.join('\n');
    }
    
    const tagResults = parseTagData(tagData);
    output.push(...tagResults);
    
  } catch (error) {
    output.push(`Error parsing tags: ${error.message}`);
  }
  
  return output.join('\n');
}

function parseTagData(tagData) {
  const output = [];
  const unknownTags = new Set();
  
  // Initialize content parsers if needed
  let controlParser = null;
  let displayParser = null;
  let assetParser = null;
  let shapeParser = null;
  let spriteParser = null;
  let fontParser = null;
  let textParser = null;
  let bitmapParser = null;
  let soundParser = null;
  let buttonParser = null;
  let videoParser = null;
  let morphParser = null;
  let scalingParser = null;
  
  // Initialize translators if needed
  let shapeTranslator = null;
  let displayTranslator = null;
  
  if (window.showContentParsing || window.showErrorsOnly) {
    if (typeof ControlParsers !== 'undefined') {
      controlParser = new ControlParsers();
    }
    if (typeof DisplayParsers !== 'undefined') {
      displayParser = new DisplayParsers();
    }
    if (typeof AssetParsers !== 'undefined') {
      assetParser = new AssetParsers();
    }
    if (typeof ShapeParsers !== 'undefined') {
      shapeParser = new ShapeParsers();
    }
    if (typeof SpriteParsers !== 'undefined') {
      spriteParser = new SpriteParsers();
    }
    if (typeof FontParsers !== 'undefined') {
      fontParser = new FontParsers();
    }
    if (typeof TextParsers !== 'undefined') {
      textParser = new TextParsers();
    }
    if (typeof BitmapParsers !== 'undefined') {
      bitmapParser = new BitmapParsers();
    }
    if (typeof SoundParsers !== 'undefined') {
      soundParser = new SoundParsers();
    }
    if (typeof ButtonParsers !== 'undefined') {
      buttonParser = new ButtonParsers();
    }
    if (typeof VideoParsers !== 'undefined') {
      videoParser = new VideoParsers();
    }
    if (typeof MorphParsers !== 'undefined') {
      morphParser = new MorphParsers();
    }
    if (typeof ScalingParsers !== 'undefined') {
      scalingParser = new ScalingParsers();
    }
    
    // Initialize translators for automatic translation
    if (typeof ShapeParserTranslator !== 'undefined') {
      shapeTranslator = new ShapeParserTranslator();
    }
    if (typeof DisplayParserTranslator !== 'undefined') {
      displayTranslator = new DisplayParserTranslator();
    }
  }
  
  // Different output format based on mode
  if (window.showContentParsing) {
    const filterDescription = getFilterDescription();
    output.push(`Parsed Tag Content${filterDescription}:`);
    output.push("==============================");
  } else if (window.showUnparsedOnly) {
    output.push("Unparsed Tags (Need Parser Development):");
    output.push("========================================");
  } else if (window.showErrorsOnly) {
    const filterDescription = getFilterDescription();
    output.push(`Parser Errors (Tags with Parsing Issues)${filterDescription}:`);
    output.push("==========================================");
  } else {
    output.push(`Tag Headers (${window.showAllTags ? 'All' : 'Important'} Tags):`);
    output.push("------------------------------");
  }
  
  // Parse tag headers
  let offset = 0;
  let tagIndex = 0;
  let displayedTags = 0;
  let parsedContentTags = 0;
  let unparsedContentTags = 0;
  let errorContentTags = 0;
  let skippedByFilter = 0;
  let translatedTags = 0;
  
  while (offset < tagData.length) {
    const tagHeader = parseTagHeader(tagData, offset);
    
    if (!tagHeader) {
      if (!window.showContentParsing && !window.showUnparsedOnly && !window.showErrorsOnly) {
        output.push(`Error parsing tag at offset ${offset}`);
      }
      break;
    }
    
    const tagName = tagNames[tagHeader.type] || "Unknown";
    const isUnknown = !tagNames[tagHeader.type];
    const isImportant = importantTags.has(tagHeader.type);
    const isControlTag = controlTags.has(tagHeader.type);
    const isDisplayTag = displayTags.has(tagHeader.type);
    const isAssetTag = assetTags.has(tagHeader.type);
    const isActionScriptTag = actionscriptTags.has(tagHeader.type);
    const isShapeTag = shapeTags.has(tagHeader.type);
    const isSpriteTag = spriteTags.has(tagHeader.type);
    const isFontTag = fontTags.has(tagHeader.type);
    const isTextTag = textTags.has(tagHeader.type);
    const isBitmapTag = bitmapTags.has(tagHeader.type);
    const isSoundTag = soundTags.has(tagHeader.type);
    const isButtonTag = buttonTags.has(tagHeader.type);
    const isVideoTag = videoTags.has(tagHeader.type);
    const isMorphTag = morphTags.has(tagHeader.type);
    const isScalingTag = scalingTags.has(tagHeader.type);
    const canBeParsed = isControlTag || isDisplayTag || isAssetTag || isActionScriptTag || isShapeTag || isSpriteTag || isFontTag || isTextTag || isBitmapTag || isSoundTag || isButtonTag || isVideoTag || isMorphTag || isScalingTag;
    
    // Check tag type filter
    const passesFilter = shouldDisplayTagByFilter(tagHeader.type);
    
    if (!passesFilter) {
      skippedByFilter++;
      // Move to next tag without processing
      offset += tagHeader.headerSize + tagHeader.length;
      tagIndex++;
      continue;
    }
    
    if (isUnknown) {
      unknownTags.add(tagHeader.type);
    }
    
    // Determine if we should display this tag based on mode
    const shouldDisplay = window.showAllTags || isImportant || isUnknown;
    
    if (window.showContentParsing) {
      // CONTENT PARSING MODE - Only show tags that can be parsed
      if (canBeParsed && tagHeader.length >= 0) {
        try {
          const contentOffset = offset + tagHeader.headerSize;
          let parsedContent = null;
          
          if (controlParser && isControlTag) {
            parsedContent = controlParser.parseTag(tagHeader.type, tagData, contentOffset, tagHeader.length);
          } else if (displayParser && isDisplayTag) {
            parsedContent = displayParser.parseTag(tagHeader.type, tagData, contentOffset, tagHeader.length);
          } else if (assetParser && (isAssetTag || isActionScriptTag)) {
            parsedContent = assetParser.parseTag(tagHeader.type, tagData, contentOffset, tagHeader.length);
          } else if (shapeParser && isShapeTag) {
            parsedContent = shapeParser.parseTag(tagHeader.type, tagData, contentOffset, tagHeader.length);
          } else if (spriteParser && isSpriteTag) {
            parsedContent = spriteParser.parseTag(tagHeader.type, tagData, contentOffset, tagHeader.length);
          } else if (fontParser && isFontTag) {
            parsedContent = fontParser.parseTag(tagHeader.type, tagData, contentOffset, tagHeader.length);
          } else if (textParser && isTextTag) {
            parsedContent = textParser.parseTag(tagHeader.type, tagData, contentOffset, tagHeader.length);
          } else if (bitmapParser && isBitmapTag) {
            parsedContent = bitmapParser.parseTag(tagHeader.type, tagData, contentOffset, tagHeader.length);
          } else if (soundParser && isSoundTag) {
            parsedContent = soundParser.parseTag(tagHeader.type, tagData, contentOffset, tagHeader.length);
          } else if (buttonParser && isButtonTag) {
            parsedContent = buttonParser.parseTag(tagHeader.type, tagData, contentOffset, tagHeader.length);
          } else if (videoParser && isVideoTag) {
            parsedContent = videoParser.parseTag(tagHeader.type, tagData, contentOffset, tagHeader.length);
          } else if (morphParser && isMorphTag) {
            parsedContent = morphParser.parseTag(tagHeader.type, tagData, contentOffset, tagHeader.length);
          } else if (scalingParser && isScalingTag) {
            parsedContent = scalingParser.parseTag(tagHeader.type, tagData, contentOffset, tagHeader.length);
          }
          
          if (parsedContent) {
            output.push(`\nTag ${tagIndex}: ${parsedContent.tagType}`);
            output.push(`Description: ${parsedContent.description}`);
            output.push(`Length: ${tagHeader.length} bytes`);
            
            if (parsedContent.error) {
              output.push(`ERROR: ${parsedContent.error}`);
            }
            
            // Automatic translator implementation - call translators with real parsed data
            let translationResult = null;
            try {
              if (shapeTranslator && isShapeTag && parsedContent.data && !parsedContent.error) {
                translationResult = shapeTranslator.translateShapeData(parsedContent);
                if (translationResult && translationResult.success) {
                  translatedTags++;
                  output.push("\n--- AUTOMATIC TRANSLATION ---");
                  output.push("Shape data translated to WebGL format");
                  output.push(`Render Commands: ${translationResult.renderCommands.length} operations`);
                  if (translationResult.translatedShape) {
                    output.push(`Shape Bounds: ${translationResult.translatedShape.bounds.width}×${translationResult.translatedShape.bounds.height} px`);
                    output.push(`Complexity: ${translationResult.translatedShape.complexity}`);
                  }
                  
                  // Store translated data for renderer
                  if (typeof window.storeTranslatedData === 'function') {
                    window.storeTranslatedData(translationResult);
                    output.push("Translated data stored for rendering");
                  }
                }
              } else if (displayTranslator && isDisplayTag && parsedContent.data && !parsedContent.error) {
                translationResult = displayTranslator.translateDisplayData(parsedContent);
                if (translationResult && translationResult.success) {
                  translatedTags++;
                  output.push("\n--- AUTOMATIC TRANSLATION ---");
                  output.push("Display data translated to WebGL format");
                  output.push(`Render Commands: ${translationResult.renderCommands.length} operations`);
                  if (translationResult.displayListState) {
                    output.push(`Display List Objects: ${translationResult.displayListState.length}`);
                  }
                  
                  // Store translated data for renderer
                  if (typeof window.storeTranslatedData === 'function') {
                    window.storeTranslatedData(translationResult);
                    output.push("Translated data stored for rendering");
                  }
                }
              }
            } catch (translationError) {
              output.push(`Translation failed: ${translationError.message}`);
            }
            
            if (parsedContent.data && Object.keys(parsedContent.data).length > 0) {
              output.push("\nContent:");
              
              // Safe content formatting with stack overflow protection
              const formatContentDataSafe = (data, indent = "  ", depth = 0, visited = new WeakSet()) => {
                // Prevent infinite recursion
                if (depth > 10) {
                  output.push(`${indent}[Max depth reached]`);
                  return;
                }
                
                // Prevent circular references
                if (typeof data === 'object' && data !== null) {
                  if (visited.has(data)) {
                    output.push(`${indent}[Circular reference detected]`);
                    return;
                  }
                  visited.add(data);
                }
                
                for (const [key, value] of Object.entries(data)) {
                  if (value === null || value === undefined) {
                    output.push(`${indent}${key}: null`);
                  } else if (typeof value === 'object' && !Array.isArray(value)) {
                    output.push(`${indent}${key}:`);
                    formatContentDataSafe(value, indent + "  ", depth + 1, visited);
                  } else if (Array.isArray(value)) {
                    output.push(`${indent}${key}: [${value.length} items]`);
                    if (value.length <= 5) {
                      value.forEach((item, index) => {
                        if (typeof item === 'object' && item !== null) {
                          output.push(`${indent}  [${index}]:`);
                          formatContentDataSafe(item, indent + "    ", depth + 1, visited);
                        } else {
                          output.push(`${indent}  [${index}]: ${String(item).substring(0, 100)}`);
                        }
                      });
                    } else {
                      output.push(`${indent}  (showing first 3 of ${value.length} items)`);
                      for (let i = 0; i < 3; i++) {
                        if (typeof value[i] === 'object' && value[i] !== null) {
                          output.push(`${indent}  [${i}]:`);
                          formatContentDataSafe(value[i], indent + "    ", depth + 1, visited);
                        } else {
                          output.push(`${indent}  [${i}]: ${String(value[i]).substring(0, 100)}`);
                        }
                      }
                    }
                  } else {
                    // Truncate very long strings
                    const stringValue = String(value);
                    const truncated = stringValue.length > 200 ? stringValue.substring(0, 200) + "..." : stringValue;
                    output.push(`${indent}${key}: ${truncated}`);
                  }
                }
                
                // Remove from visited set when done (for reuse in sibling branches)
                if (typeof data === 'object' && data !== null) {
                  visited.delete(data);
                }
              };
              
              formatContentDataSafe(parsedContent.data);
            }
            
            parsedContentTags++;
          }
          
        } catch (contentError) {
          output.push(`\nTag ${tagIndex}: ${tagName} (Parse Error)`);
          output.push(`ERROR: ${contentError.message}`);
          // Add stack trace for debugging
          if (contentError.stack) {
            output.push(`Stack trace: ${contentError.stack.substring(0, 300)}...`);
          }
        }
      }
      
    } else if (window.showUnparsedOnly) {
      // UNPARSED CONTENT MODE - Only show tags that CANNOT be parsed
      if (!canBeParsed && shouldDisplay) {
        let tagDisplay = `Tag ${tagIndex}: Type ${tagHeader.type} (${tagName}), Length ${tagHeader.length} bytes`;
        if (isUnknown) {
          tagDisplay += " [UNKNOWN - No parser available]";
        } else {
          tagDisplay += " [NEEDS PARSER]";
        }
        
        // Add some hints about what type of parser this might need
        const tagTypeHints = {
          87: "Binary data parser needed"
        };
        
        if (tagTypeHints[tagHeader.type]) {
          tagDisplay += ` - ${tagTypeHints[tagHeader.type]}`;
        }
        
        output.push(tagDisplay);
        unparsedContentTags++;
      }
      
    } else if (window.showErrorsOnly) {
      // ERROR-ONLY MODE - Only show tags that have parsers but encountered errors
      if (canBeParsed && tagHeader.length >= 0) {
        try {
          const contentOffset = offset + tagHeader.headerSize;
          let parsedContent = null;
          let hasError = false;
          
          if (controlParser && isControlTag) {
            parsedContent = controlParser.parseTag(tagHeader.type, tagData, contentOffset, tagHeader.length);
          } else if (displayParser && isDisplayTag) {
            parsedContent = displayParser.parseTag(tagHeader.type, tagData, contentOffset, tagHeader.length);
          } else if (assetParser && (isAssetTag || isActionScriptTag)) {
            parsedContent = assetParser.parseTag(tagHeader.type, tagData, contentOffset, tagHeader.length);
          } else if (shapeParser && isShapeTag) {
            parsedContent = shapeParser.parseTag(tagHeader.type, tagData, contentOffset, tagHeader.length);
          } else if (spriteParser && isSpriteTag) {
            parsedContent = spriteParser.parseTag(tagHeader.type, tagData, contentOffset, tagHeader.length);
          } else if (fontParser && isFontTag) {
            parsedContent = fontParser.parseTag(tagHeader.type, tagData, contentOffset, tagHeader.length);
          } else if (textParser && isTextTag) {
            parsedContent = textParser.parseTag(tagHeader.type, tagData, contentOffset, tagHeader.length);
          } else if (bitmapParser && isBitmapTag) {
            parsedContent = bitmapParser.parseTag(tagHeader.type, tagData, contentOffset, tagHeader.length);
          } else if (soundParser && isSoundTag) {
            parsedContent = soundParser.parseTag(tagHeader.type, tagData, contentOffset, tagHeader.length);
          } else if (buttonParser && isButtonTag) {
            parsedContent = buttonParser.parseTag(tagHeader.type, tagData, contentOffset, tagHeader.length);
          } else if (videoParser && isVideoTag) {
            parsedContent = videoParser.parseTag(tagHeader.type, tagData, contentOffset, tagHeader.length);
          } else if (morphParser && isMorphTag) {
            parsedContent = morphParser.parseTag(tagHeader.type, tagData, contentOffset, tagHeader.length);
          } else if (scalingParser && isScalingTag) {
            parsedContent = scalingParser.parseTag(tagHeader.type, tagData, contentOffset, tagHeader.length);
          }
          
          // Check if the parsed content has an error
          if (parsedContent && parsedContent.error) {
            hasError = true;
          }
          
          // Also check for errors in nested data (safely)
          if (parsedContent && parsedContent.data) {
            const checkForErrorsSafe = (obj, depth = 0) => {
              if (depth > 10) return false; // Prevent deep recursion
              
              if (typeof obj === 'object' && obj !== null) {
                if (obj.error || obj.parseError) return true;
                for (const value of Object.values(obj)) {
                  if (checkForErrorsSafe(value, depth + 1)) return true;
                }
              }
              return false;
            };
            
            if (checkForErrorsSafe(parsedContent.data)) {
              hasError = true;
            }
          }
          
          if (hasError) {
            output.push(`\nTag ${tagIndex}: ${parsedContent.tagType || tagName}`);
            output.push(`Description: ${parsedContent.description || 'Tag with parsing errors'}`);
            output.push(`Length: ${tagHeader.length} bytes`);
            output.push(`PARSER ERROR: ${parsedContent.error}`);
            
            // Show problematic data sections (safely)
            if (parsedContent.data) {
              const showErrorDetailsSafe = (obj, path = "", depth = 0) => {
                if (depth > 5) return; // Limit depth for error display
                
                if (typeof obj === 'object' && obj !== null) {
                  for (const [key, value] of Object.entries(obj)) {
                    const currentPath = path ? `${path}.${key}` : key;
                    if (value && (value.error || value.parseError)) {
                      output.push(`  └─ Error in ${currentPath}: ${value.error || value.parseError}`);
                    } else if (typeof value === 'object') {
                      showErrorDetailsSafe(value, currentPath, depth + 1);
                    }
                  }
                }
              };
              
              showErrorDetailsSafe(parsedContent.data);
            }
            
            errorContentTags++;
          }
          
        } catch (contentError) {
          output.push(`\nTag ${tagIndex}: ${tagName} (Critical Parse Error)`);
          output.push(`Length: ${tagHeader.length} bytes`);
          output.push(`CRITICAL ERROR: ${contentError.message}`);
          output.push(`  └─ This indicates a serious parser bug or corrupted data`);
          errorContentTags++;
        }
      }
      
    } else {
      // NORMAL TAG HEADER MODE
      if (shouldDisplay) {
        let tagDisplay = `Tag ${tagIndex}: Type ${tagHeader.type} (${tagName}), Length ${tagHeader.length} bytes`;
        if (isUnknown) {
          tagDisplay += " [UNKNOWN]";
        }
        output.push(tagDisplay);
        displayedTags++;
      }
    }
    
    // If this is the End tag (type 0), stop parsing
    if (tagHeader.type === 0) {
      if (!window.showContentParsing && !window.showUnparsedOnly && !window.showErrorsOnly) {
        output.push("End tag reached");
      }
      break;
    }
    
    // Move to next tag
    offset += tagHeader.headerSize + tagHeader.length;
    tagIndex++;
    
    // Safety check to prevent infinite loops
    if (tagIndex > 10000) {
      output.push("Maximum tag limit reached (10000 tags)");
      break;
    }
  }
  
  // Summary based on mode
  if (window.showContentParsing) {
    output.push(`\n==============================`);
    output.push(`Total tags scanned: ${tagIndex}`);
    output.push(`Tags with parsed content: ${parsedContentTags}`);
    output.push(`Tags automatically translated: ${translatedTags}`);
    
    if (skippedByFilter > 0) {
      output.push(`Tags filtered out: ${skippedByFilter}`);
    }
    
    if (parsedContentTags === 0) {
      output.push("\nNo tags could be parsed for content.");
      output.push("Supported tag types: Control, Display, Asset, ActionScript, Shape, Sprite, Font, Text, Bitmap, Sound, Button, Video, Morph, and Scaling tags");
    }
    
    if (translatedTags > 0) {
      output.push(`\nAutomatic translation enabled: ${translatedTags} tags converted to WebGL format`);
      output.push("Translated data available for rendering - click 'Render Translated Data' button");
    }
    
  } else if (window.showUnparsedOnly) {
    output.push(`\n========================================`);
    output.push(`Total tags scanned: ${tagIndex}`);
    output.push(`Unparsed tags found: ${unparsedContentTags}`);
    
    if (unparsedContentTags === 0) {
      output.push("\nAll displayed tags have parsers available!");
      output.push("This means we can parse the content of all important tags in this file.");
    } else {
      output.push(`\nThese ${unparsedContentTags} tags need parser development to extract their content.`);
      output.push("Priority should be given to frequently occurring and important tag types.");
    }
    
  } else if (window.showErrorsOnly) {
    output.push(`\n==========================================`);
    output.push(`Total tags scanned: ${tagIndex}`);
    output.push(`Tags with parser errors: ${errorContentTags}`);
    
    if (skippedByFilter > 0) {
      output.push(`Tags filtered out: ${skippedByFilter}`);
    }
    
    if (errorContentTags === 0) {
      output.push("\nNo parsing errors detected!");
      output.push("All parseable tags were processed successfully.");
    } else {
      output.push(`\nFound ${errorContentTags} tags with parsing issues.`);
      output.push("These errors indicate either:");
      output.push("• Corrupted or malformed SWF data");
      output.push("• Bugs in our parser implementations");
      output.push("• Unsupported variants of known tag formats");
    }
    
  } else {
    output.push(`Total tags parsed: ${tagIndex}, Displayed: ${displayedTags}`);
    
    if (unknownTags.size > 0) {
      output.push("------------------------------");
      output.push("Unknown Tag Types Found:");
      const sortedUnknown = Array.from(unknownTags).sort((a, b) => a - b);
      sortedUnknown.forEach(tagType => {
        output.push(`Type ${tagType}`);
      });
    }
  }
  
  return output;
}

// Helper function to describe current filter
function getFilterDescription() {
  if (!window.tagTypeFilter) {
    return "";
  }
  
  if (window.tagTypeFilter.type === 'specific') {
    const tagName = tagNames[window.tagTypeFilter.tagType] || `Type ${window.tagTypeFilter.tagType}`;
    return ` (Filtered: ${tagName} only)`;
  } else if (window.tagTypeFilter.type === 'category') {
    const categoryNames = {
      'control': 'Control Tags',
      'display': 'Display Tags', 
      'asset': 'Asset Tags',
      'actionscript': 'ActionScript Tags',
      'shape': 'Shape Tags',
      'sprite': 'Sprite Tags',
      'font': 'Font Tags',
      'text': 'Text Tags',
      'bitmap': 'Bitmap Tags',
      'sound': 'Sound Tags',
      'button': 'Button Tags',
      'video': 'Video Tags',
      'morph': 'Morph Shape Tags',
      'scaling': 'Scaling Tags'
    };
    return ` (Filtered: ${categoryNames[window.tagTypeFilter.category]} only)`;
  }
  
  return "";
}

function parseTagHeader(data, offset) {
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
