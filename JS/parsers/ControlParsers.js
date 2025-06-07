/* 
 * SWF Control Definition Tags Parser - v1.2
 * Handles control flow and document structure tags
 * End (0), ShowFrame (1), SetBackgroundColor (9), Protect (24),
 * FrameLabel (43), FileAttributes (69), Metadata (77), DefineSceneAndFrameLabelData (86)
 * FIXED: Corrected parseSTRING to parseString method name
 */
class ControlParsers {
  constructor() {
    this.dataTypes = new SWFDataTypes();
  }
  
  // ==================== TAG PARSING DISPATCHER ====================
  
  parseTag(tagType, tagData, offset, length) {
    const reader = new BitReader(tagData, offset);
    
    switch (tagType) {
      case 0:
        return this.parseEnd(reader, length);
      case 1:
        return this.parseShowFrame(reader, length);
      case 9:
        return this.parseSetBackgroundColor(reader, length);
      case 24:
        return this.parseProtect(reader, length);
      case 43:
        return this.parseFrameLabel(reader, length);
      case 69:
        return this.parseFileAttributes(reader, length);
      case 77:
        return this.parseMetadata(reader, length);
      case 86:
        return this.parseDefineSceneAndFrameLabelData(reader, length);
      default:
        return this.parseUnknownControlTag(tagType, reader, length);
    }
  }
  
  // ==================== SPECIFIC TAG PARSERS ====================
  
  parseEnd(reader, length) {
    return {
      tagType: "End",
      description: "Marks the end of the SWF file",
      data: {
        note: "This tag has no content - it simply marks the end of the tag stream",
        fileComplete: true
      }
    };
  }
  
  parseShowFrame(reader, length) {
    return {
      tagType: "ShowFrame",
      description: "Instructs Flash Player to display the current frame",
      data: {
        note: "This tag has no content - it triggers frame display and advances the timeline",
        frameAction: "display_and_advance"
      }
    };
  }
  
  parseSetBackgroundColor(reader, length) {
    try {
      const color = this.dataTypes.parseRGB(reader);
      
      return {
        tagType: "SetBackgroundColor",
        description: "Sets the background color of the stage",
        data: {
          color: color,
          hex: `#${color.red.toString(16).padStart(2, '0')}${color.green.toString(16).padStart(2, '0')}${color.blue.toString(16).padStart(2, '0')}`,
          rgb: `rgb(${color.red}, ${color.green}, ${color.blue})`,
          brightness: Math.round((color.red * 0.299 + color.green * 0.587 + color.blue * 0.114)),
          colorType: this.analyzeColorType(color)
        }
      };
      
    } catch (error) {
      return {
        tagType: "SetBackgroundColor",
        description: "Sets the background color of the stage",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseProtect(reader, length) {
    try {
      let password = null;
      
      if (length > 0) {
        // MD5 hash password protection (16 bytes)
        if (length === 16) {
          const hash = [];
          for (let i = 0; i < 16; i++) {
            hash.push(this.dataTypes.parseUI8(reader).toString(16).padStart(2, '0'));
          }
          password = hash.join('');
        } else {
          // Read as string for other lengths
          password = this.dataTypes.parseString(reader);
        }
      }
      
      return {
        tagType: "Protect",
        description: "Prevents the SWF file from being imported or decompiled",
        data: {
          hasPassword: password !== null,
          passwordType: length === 16 ? "MD5_hash" : length > 0 ? "string" : "none",
          password: password,
          protection: "import_decompile_protected",
          note: length === 0 ? "Basic protection without password" : "Password-protected file"
        }
      };
      
    } catch (error) {
      return {
        tagType: "Protect",
        description: "Prevents the SWF file from being imported or decompiled",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseFrameLabel(reader, length) {
    try {
      const name = this.dataTypes.parseString(reader);
      let namedAnchor = false;
      
      // Check if there's a named anchor flag (Flash MX and later)
      const remainingLength = length - (name.length + 1);
      if (remainingLength > 0) {
        const flags = this.dataTypes.parseUI8(reader);
        namedAnchor = (flags & 0x01) !== 0;
      }
      
      return {
        tagType: "FrameLabel",
        description: "Assigns a label name to the current frame",
        data: {
          name: name,
          namedAnchor: namedAnchor,
          labelType: namedAnchor ? "named_anchor" : "frame_label",
          navigation: namedAnchor ? "Can be used for HTML anchors and deep linking" : "Used for ActionScript frame navigation",
          actionScriptTarget: `gotoAndPlay("${name}")`,
          length: name.length
        }
      };
      
    } catch (error) {
      return {
        tagType: "FrameLabel",
        description: "Assigns a label name to the current frame",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseFileAttributes(reader, length) {
    try {
      const flags = this.dataTypes.parseUI32(reader);
      
      // Extract individual flags
      const useDirectBlit = (flags & 0x40) !== 0;
      const useGPU = (flags & 0x20) !== 0;
      const hasMetadata = (flags & 0x10) !== 0;
      const actionScript3 = (flags & 0x08) !== 0;
      const suppressCrossDomainCaching = (flags & 0x04) !== 0;
      const swfRelativeUrls = (flags & 0x02) !== 0;
      const useNetwork = (flags & 0x01) !== 0;
      
      return {
        tagType: "FileAttributes",
        description: "Defines characteristics and capabilities of the SWF file",
        data: {
          flags: flags,
          flagsHex: `0x${flags.toString(16).toUpperCase()}`,
          attributes: {
            useDirectBlit: useDirectBlit,
            useGPU: useGPU,
            hasMetadata: hasMetadata,
            actionScript3: actionScript3,
            suppressCrossDomainCaching: suppressCrossDomainCaching,
            swfRelativeUrls: swfRelativeUrls,
            useNetwork: useNetwork
          },
          capabilities: {
            renderingMode: useDirectBlit ? "Direct Blit" : useGPU ? "GPU Accelerated" : "Software",
            scriptingVersion: actionScript3 ? "ActionScript 3.0" : "ActionScript 1.0/2.0",
            networkAccess: useNetwork ? "Network sandbox" : "Local file sandbox",
            urlHandling: swfRelativeUrls ? "Relative to SWF" : "Relative to HTML page"
          },
          security: {
            crossDomainCaching: !suppressCrossDomainCaching,
            localAccess: !useNetwork,
            networkAccess: useNetwork
          },
          performance: {
            hardwareAcceleration: useGPU,
            directBlit: useDirectBlit,
            optimized: useGPU || useDirectBlit
          }
        }
      };
      
    } catch (error) {
      return {
        tagType: "FileAttributes",
        description: "Defines characteristics and capabilities of the SWF file",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseMetadata(reader, length) {
    try {
      const xmlString = this.dataTypes.parseString(reader);
      
      return {
        tagType: "Metadata",
        description: "Contains XMP metadata about the SWF file",
        data: {
          xmlLength: xmlString.length,
          xmlString: xmlString,
          hasContent: xmlString.length > 0,
          metadata: this.parseXMPMetadata(xmlString),
          note: "Contains Adobe XMP (Extensible Metadata Platform) data"
        }
      };
      
    } catch (error) {
      return {
        tagType: "Metadata",
        description: "Contains XMP metadata about the SWF file",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseDefineSceneAndFrameLabelData(reader, length) {
    try {
      // Parse scene count
      const sceneCount = this.parseEncodedU32(reader);
      const scenes = [];
      
      // Parse scenes
      for (let i = 0; i < Math.min(sceneCount, 50); i++) {
        const offset = this.parseEncodedU32(reader);
        const name = this.dataTypes.parseString(reader);
        scenes.push({
          offset: offset,
          name: name,
          frameNumber: offset + 1 // Frame numbers are 1-based
        });
      }
      
      // Parse frame label count
      const frameLabelCount = this.parseEncodedU32(reader);
      const frameLabels = [];
      
      // Parse frame labels
      for (let i = 0; i < Math.min(frameLabelCount, 100); i++) {
        const frameNumber = this.parseEncodedU32(reader);
        const label = this.dataTypes.parseString(reader);
        frameLabels.push({
          frameNumber: frameNumber + 1, // Frame numbers are 1-based
          label: label
        });
      }
      
      return {
        tagType: "DefineSceneAndFrameLabelData",
        description: "Defines scene boundaries and frame labels for the entire SWF",
        data: {
          sceneCount: sceneCount,
          scenes: scenes,
          frameLabelCount: frameLabelCount,
          frameLabels: frameLabels,
          truncated: {
            scenes: sceneCount > 50,
            frameLabels: frameLabelCount > 100
          },
          totalFrames: scenes.length > 0 ? Math.max(...scenes.map(s => s.offset)) : 0,
          navigation: {
            sceneNavigation: scenes.length > 1,
            labelNavigation: frameLabels.length > 0,
            complexTimeline: scenes.length > 1 || frameLabels.length > 5
          }
        }
      };
      
    } catch (error) {
      return {
        tagType: "DefineSceneAndFrameLabelData",
        description: "Defines scene boundaries and frame labels for the entire SWF",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseUnknownControlTag(tagType, reader, length) {
    const data = [];
    const bytesToRead = Math.min(length, 32);
    
    for (let i = 0; i < bytesToRead; i++) {
      data.push(this.dataTypes.parseUI8(reader));
    }
    
    return {
      tagType: `Unknown Control Tag ${tagType}`,
      description: "Unknown or unsupported control tag",
      data: {
        rawBytes: data,
        totalLength: length,
        truncated: length > 32,
        note: length > 32 ? "Data truncated to first 32 bytes" : "Complete data shown"
      }
    };
  }
  
  // ==================== UTILITY METHODS ====================
  
  analyzeColorType(color) {
    const r = color.red;
    const g = color.green;
    const b = color.blue;
    
    // Check for common color types
    if (r === g && g === b) {
      if (r === 0) return "black";
      if (r === 255) return "white";
      return "grayscale";
    }
    
    if (r === 255 && g === 0 && b === 0) return "pure_red";
    if (r === 0 && g === 255 && b === 0) return "pure_green";
    if (r === 0 && g === 0 && b === 255) return "pure_blue";
    
    if (r > 200 && g > 200 && b > 200) return "light";
    if (r < 50 && g < 50 && b < 50) return "dark";
    
    return "color";
  }
  
  parseXMPMetadata(xmlString) {
    if (!xmlString || xmlString.length === 0) {
      return {
        valid: false,
        note: "No metadata content"
      };
    }
    
    // Basic XMP parsing (simplified)
    const metadata = {
      valid: true,
      format: "XMP",
      extracted: {}
    };
    
    try {
      // Look for common XMP fields
      const titleMatch = xmlString.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i);
      if (titleMatch) metadata.extracted.title = titleMatch[1];
      
      const creatorMatch = xmlString.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/i);
      if (creatorMatch) metadata.extracted.creator = creatorMatch[1];
      
      const descriptionMatch = xmlString.match(/<dc:description[^>]*>([^<]+)<\/dc:description>/i);
      if (descriptionMatch) metadata.extracted.description = descriptionMatch[1];
      
      const dateMatch = xmlString.match(/<xmp:CreateDate[^>]*>([^<]+)<\/xmp:CreateDate>/i);
      if (dateMatch) metadata.extracted.createDate = dateMatch[1];
      
      const modifyDateMatch = xmlString.match(/<xmp:ModifyDate[^>]*>([^<]+)<\/xmp:ModifyDate>/i);
      if (modifyDateMatch) metadata.extracted.modifyDate = modifyDateMatch[1];
      
      const creatorToolMatch = xmlString.match(/<xmp:CreatorTool[^>]*>([^<]+)<\/xmp:CreatorTool>/i);
      if (creatorToolMatch) metadata.extracted.creatorTool = creatorToolMatch[1];
      
      // Check for Flash-specific metadata
      if (xmlString.includes('xmlns:x="adobe:ns:meta/"')) {
        metadata.adobeXMP = true;
      }
      
      if (xmlString.includes('Flash') || xmlString.includes('Animate')) {
        metadata.createdWithFlash = true;
      }
      
      metadata.fieldCount = Object.keys(metadata.extracted).length;
      metadata.hasUsefulData = metadata.fieldCount > 0;
      
    } catch (error) {
      metadata.parseError = error.message;
      metadata.valid = false;
    }
    
    return metadata;
  }
  
  parseEncodedU32(reader) {
    // Variable-length encoding used in DefineSceneAndFrameLabelData
    let result = 0;
    let shift = 0;
    
    while (shift < 35) { // Prevent infinite loop
      const byte = this.dataTypes.parseUI8(reader);
      result |= (byte & 0x7F) << shift;
      
      if ((byte & 0x80) === 0) {
        break;
      }
      
      shift += 7;
    }
    
    return result;
  }
  
  formatTagOutput(parsedTag) {
    const lines = [];
    lines.push(`  └─ ${parsedTag.description}`);
    
    if (parsedTag.error) {
      lines.push(`  └─ ERROR: ${parsedTag.error}`);
    }
    
    if (parsedTag.data) {
      const data = parsedTag.data;
      
      switch (parsedTag.tagType) {
        case "SetBackgroundColor":
          lines.push(`  └─ Color: ${data.hex} (${data.rgb})`);
          lines.push(`  └─ Type: ${data.colorType}, Brightness: ${data.brightness}`);
          break;
          
        case "FrameLabel":
          lines.push(`  └─ Label: "${data.name}"`);
          lines.push(`  └─ Type: ${data.labelType}`);
          if (data.namedAnchor) {
            lines.push(`  └─ HTML Anchor: Enabled`);
          }
          break;
          
        case "FileAttributes":
          lines.push(`  └─ ActionScript: ${data.capabilities.scriptingVersion}`);
          lines.push(`  └─ Rendering: ${data.capabilities.renderingMode}`);
          lines.push(`  └─ Network Access: ${data.capabilities.networkAccess}`);
          if (data.attributes.hasMetadata) {
            lines.push(`  └─ Has Metadata: Yes`);
          }
          break;
          
        case "Metadata":
          lines.push(`  └─ XML Length: ${data.xmlLength} characters`);
          if (data.metadata && data.metadata.hasUsefulData) {
            lines.push(`  └─ Fields: ${data.metadata.fieldCount} metadata fields found`);
            if (data.metadata.extracted.title) {
              lines.push(`  └─ Title: "${data.metadata.extracted.title}"`);
            }
            if (data.metadata.extracted.creatorTool) {
              lines.push(`  └─ Created with: ${data.metadata.extracted.creatorTool}`);
            }
          }
          break;
          
        case "DefineSceneAndFrameLabelData":
          lines.push(`  └─ Scenes: ${data.sceneCount}`);
          lines.push(`  └─ Frame Labels: ${data.frameLabelCount}`);
          if (data.navigation.complexTimeline) {
            lines.push(`  └─ Complex Timeline: Multiple scenes or many labels`);
          }
          break;
          
        case "Protect":
          lines.push(`  └─ Protection: ${data.protection}`);
          lines.push(`  └─ Password Type: ${data.passwordType}`);
          break;
      }
    }
    
    return lines.join('\n');
  }
}

// Export for use by other parsers
window.ControlParsers = ControlParsers;
