/* 
 * SWF Tag Parser - v2.2
 * Supports:
 * - Tag header parsing (type and length)
 * - Short and long format tag headers
 * - FWS, CWS, and ZWS formats
 * - Tag names and unknown tag detection
 * - Filter for important tags only
 * - Content parsing mode (shows ONLY parsed content)
 */

// Global variables for tag filtering
window.showAllTags = false;
window.showContentParsing = false;

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
  0, 1, 4, 5, 9, 12, 24, 26, 28, 39, 43, 56, 57, 59, 69, 76, 77, 82, 86
]);

// Control tags that can be parsed for content
const controlTags = new Set([
  0, 1, 9, 24, 43, 69, 77, 86
]);

// Display tags that can be parsed for content
const displayTags = new Set([
  4, 5, 26, 28
]);

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
  
  if (window.showContentParsing) {
    if (typeof ControlParsers !== 'undefined') {
      controlParser = new ControlParsers();
    }
    if (typeof DisplayParsers !== 'undefined') {
      displayParser = new DisplayParsers();
    }
  }
  
  // Different output format based on content parsing mode
  if (window.showContentParsing) {
    output.push("Parsed Tag Content:");
    output.push("==============================");
  } else {
    output.push(`Tag Headers (${window.showAllTags ? 'All' : 'Important'} Tags):`);
    output.push("------------------------------");
  }
  
  // Parse tag headers
  let offset = 0;
  let tagIndex = 0;
  let displayedTags = 0;
  let parsedContentTags = 0;
  
  while (offset < tagData.length) {
    const tagHeader = parseTagHeader(tagData, offset);
    
    if (!tagHeader) {
      if (!window.showContentParsing) {
        output.push(`Error parsing tag at offset ${offset}`);
      }
      break;
    }
    
    const tagName = tagNames[tagHeader.type] || "Unknown";
    const isUnknown = !tagNames[tagHeader.type];
    const isImportant = importantTags.has(tagHeader.type);
    const isControlTag = controlTags.has(tagHeader.type);
    const isDisplayTag = displayTags.has(tagHeader.type);
    const canBeParsed = isControlTag || isDisplayTag;
    
    if (isUnknown) {
      unknownTags.add(tagHeader.type);
    }
    
    // Determine if we should display this tag
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
          }
          
          if (parsedContent) {
            output.push(`\nTag ${tagIndex}: ${parsedContent.tagType}`);
            output.push(`Description: ${parsedContent.description}`);
            output.push(`Length: ${tagHeader.length} bytes`);
            
            if (parsedContent.error) {
              output.push(`ERROR: ${parsedContent.error}`);
            }
            
            if (parsedContent.data && Object.keys(parsedContent.data).length > 0) {
              output.push("Content:");
              
              // Format the content data nicely
              const formatContentData = (data, indent = "  ") => {
                for (const [key, value] of Object.entries(data)) {
                  if (value === null || value === undefined) {
                    output.push(`${indent}${key}: null`);
                  } else if (typeof value === 'object' && !Array.isArray(value)) {
                    output.push(`${indent}${key}:`);
                    formatContentData(value, indent + "  ");
                  } else if (Array.isArray(value)) {
                    output.push(`${indent}${key}: [${value.length} items]`);
                    if (value.length <= 10) {
                      value.forEach((item, index) => {
                        output.push(`${indent}  [${index}]: ${JSON.stringify(item)}`);
                      });
                    } else {
                      output.push(`${indent}  (showing first 5 of ${value.length} items)`);
                      for (let i = 0; i < 5; i++) {
                        output.push(`${indent}  [${i}]: ${JSON.stringify(value[i])}`);
                      }
                    }
                  } else {
                    output.push(`${indent}${key}: ${value}`);
                  }
                }
              };
              
              formatContentData(parsedContent.data);
            }
            
            parsedContentTags++;
          }
          
        } catch (contentError) {
          output.push(`\nTag ${tagIndex}: ${tagName} (Parse Error)`);
          output.push(`ERROR: ${contentError.message}`);
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
      if (!window.showContentParsing) {
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
    
    if (parsedContentTags === 0) {
      output.push("\nNo tags could be parsed for content.");
      output.push("Supported tag types: Control tags (SetBackgroundColor, FrameLabel, etc.) and Display tags (PlaceObject, RemoveObject, etc.)");
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
