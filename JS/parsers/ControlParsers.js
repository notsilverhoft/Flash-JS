/* 
 * SWF Control Tags Parser - v1.0
 * Handles basic control flow and metadata tags
 * Simple tags to establish parsing patterns
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
      description: "Marks the end of the file",
      data: {
        note: "No additional data"
      }
    };
  }
  
  parseShowFrame(reader, length) {
    return {
      tagType: "ShowFrame",
      description: "Displays current frame and advances to next frame",
      data: {
        note: "No additional data - this tag has no content"
      }
    };
  }
  
  parseSetBackgroundColor(reader, length) {
    if (length !== 3) {
      return {
        tagType: "SetBackgroundColor",
        description: "Sets the background color of the display",
        error: `Invalid length: expected 3 bytes, got ${length} bytes`,
        data: {}
      };
    }
    
    const color = this.dataTypes.parseRGB(reader);
    
    return {
      tagType: "SetBackgroundColor",
      description: "Sets the background color of the display",
      data: {
        color: color,
        colorString: this.dataTypes.formatColor(color),
        hexColor: `#${color.red.toString(16).padStart(2, '0')}${color.green.toString(16).padStart(2, '0')}${color.blue.toString(16).padStart(2, '0')}`
      }
    };
  }
  
  parseProtect(reader, length) {
    let data = {
      note: "File is protected from import"
    };
    
    if (length > 0) {
      // Sometimes contains a password hash
      const passwordData = [];
      for (let i = 0; i < length; i++) {
        passwordData.push(this.dataTypes.parseUI8(reader));
      }
      data.passwordHash = passwordData;
      data.note = "File is password protected";
    }
    
    return {
      tagType: "Protect",
      description: "Protects the SWF file from being imported into Flash authoring environment",
      data: data
    };
  }
  
  parseFrameLabel(reader, length) {
    if (length === 0) {
      return {
        tagType: "FrameLabel",
        description: "Labels a frame for ActionScript targeting",
        error: "No data provided",
        data: {}
      };
    }
    
    const label = this.dataTypes.parseSTRING(reader);
    
    // Check if there's additional data (anchor flag in Flash MX and later)
    const remainingBytes = length - (label.length + 1); // +1 for null terminator
    let isAnchor = false;
    
    if (remainingBytes > 0) {
      isAnchor = this.dataTypes.parseUI8(reader) !== 0;
    }
    
    return {
      tagType: "FrameLabel",
      description: "Labels a frame for ActionScript targeting",
      data: {
        label: label,
        isAnchor: isAnchor,
        note: isAnchor ? "Frame is marked as an anchor" : "Standard frame label"
      }
    };
  }
  
  parseFileAttributes(reader, length) {
    if (length !== 4) {
      return {
        tagType: "FileAttributes",
        description: "Defines characteristics of the SWF file",
        error: `Invalid length: expected 4 bytes, got ${length} bytes`,
        data: {}
      };
    }
    
    const attributes = this.dataTypes.parseUI32(reader);
    
    return {
      tagType: "FileAttributes",
      description: "Defines characteristics of the SWF file",
      data: {
        rawValue: attributes,
        useDirectBlit: (attributes & 0x40) !== 0,
        useGPU: (attributes & 0x20) !== 0,
        hasMetadata: (attributes & 0x10) !== 0,
        actionScript3: (attributes & 0x08) !== 0,
        suppressCrossDomainCaching: (attributes & 0x04) !== 0,
        swfRelativeUrls: (attributes & 0x02) !== 0,
        useNetwork: (attributes & 0x01) !== 0,
        reserved: (attributes & 0x80) !== 0
      }
    };
  }
  
  parseMetadata(reader, length) {
    if (length === 0) {
      return {
        tagType: "Metadata",
        description: "Contains XMP metadata",
        error: "No metadata provided",
        data: {}
      };
    }
    
    const metadata = this.dataTypes.parseSTRING(reader);
    
    // Try to parse as XML
    let parsedXML = null;
    try {
      if (typeof DOMParser !== 'undefined') {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(metadata, "text/xml");
        if (!xmlDoc.getElementsByTagName("parsererror").length) {
          parsedXML = "Valid XML structure detected";
        }
      }
    } catch (e) {
      // XML parsing failed, that's okay
    }
    
    return {
      tagType: "Metadata",
      description: "Contains XMP metadata about the SWF file",
      data: {
        metadata: metadata,
        length: metadata.length,
        xmlValid: parsedXML !== null,
        preview: metadata.length > 100 ? metadata.substring(0, 100) + "..." : metadata
      }
    };
  }
  
  parseDefineSceneAndFrameLabelData(reader, length) {
    try {
      // Parse scene count
      const sceneCount = this.dataTypes.parseUI32(reader);
      const scenes = [];
      
      // Parse scenes
      for (let i = 0; i < sceneCount; i++) {
        const offset = this.dataTypes.parseUI32(reader);
        const name = this.dataTypes.parseSTRING(reader);
        scenes.push({ offset, name });
      }
      
      // Parse frame label count
      const frameLabelCount = this.dataTypes.parseUI32(reader);
      const frameLabels = [];
      
      // Parse frame labels
      for (let i = 0; i < frameLabelCount; i++) {
        const frameNumber = this.dataTypes.parseUI32(reader);
        const label = this.dataTypes.parseSTRING(reader);
        frameLabels.push({ frameNumber, label });
      }
      
      return {
        tagType: "DefineSceneAndFrameLabelData",
        description: "Defines scenes and frame labels for navigation",
        data: {
          sceneCount: sceneCount,
          scenes: scenes,
          frameLabelCount: frameLabelCount,
          frameLabels: frameLabels
        }
      };
      
    } catch (error) {
      return {
        tagType: "DefineSceneAndFrameLabelData",
        description: "Defines scenes and frame labels for navigation",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseUnknownControlTag(tagType, reader, length) {
    const data = [];
    
    // Read raw bytes (limited to prevent memory issues)
    const bytesToRead = Math.min(length, 64);
    for (let i = 0; i < bytesToRead; i++) {
      data.push(this.dataTypes.parseUI8(reader));
    }
    
    return {
      tagType: `Unknown Control Tag ${tagType}`,
      description: "Unknown or unsupported control tag",
      data: {
        rawBytes: data,
        totalLength: length,
        truncated: length > 64,
        note: length > 64 ? "Data truncated to first 64 bytes" : "Complete data shown"
      }
    };
  }
  
  // ==================== UTILITY METHODS ====================
  
  formatTagOutput(parsedTag) {
    const lines = [];
    lines.push(`  └─ ${parsedTag.description}`);
    
    if (parsedTag.error) {
      lines.push(`  └─ ERROR: ${parsedTag.error}`);
    }
    
    // Format specific data based on tag type
    if (parsedTag.data) {
      switch (parsedTag.tagType) {
        case "SetBackgroundColor":
          if (parsedTag.data.colorString) {
            lines.push(`  └─ Color: ${parsedTag.data.colorString} (${parsedTag.data.hexColor})`);
          }
          break;
          
        case "FrameLabel":
          if (parsedTag.data.label) {
            lines.push(`  └─ Label: "${parsedTag.data.label}"`);
            if (parsedTag.data.isAnchor) {
              lines.push(`  └─ Anchor: Yes`);
            }
          }
          break;
          
        case "FileAttributes":
          const attrs = parsedTag.data;
          lines.push(`  └─ ActionScript 3: ${attrs.actionScript3 ? 'Yes' : 'No'}`);
          lines.push(`  └─ Has Metadata: ${attrs.hasMetadata ? 'Yes' : 'No'}`);
          lines.push(`  └─ Use Network: ${attrs.useNetwork ? 'Yes' : 'No'}`);
          if (attrs.useGPU) lines.push(`  └─ GPU Acceleration: Yes`);
          break;
          
        case "Metadata":
          if (parsedTag.data.preview) {
            lines.push(`  └─ Preview: ${parsedTag.data.preview}`);
            lines.push(`  └─ Length: ${parsedTag.data.length} characters`);
          }
          break;
          
        case "DefineSceneAndFrameLabelData":
          lines.push(`  └─ Scenes: ${parsedTag.data.sceneCount}`);
          lines.push(`  └─ Frame Labels: ${parsedTag.data.frameLabelCount}`);
          break;
          
        default:
          if (parsedTag.data.note) {
            lines.push(`  └─ ${parsedTag.data.note}`);
          }
          break;
      }
    }
    
    return lines.join('\n');
  }
}

// Export for use by other parsers
window.ControlParsers = ControlParsers;
