/* 
 * SWF Asset Definition Tags Parser - v2.1
 * Handles asset-related tags like actions, exports, imports, and symbols
 * DoAction (12), ExportAssets (56), ImportAssets (57), DoInitAction (59),
 * ImportAssets2 (71), SymbolClass (76), DoABC (82)
 * ENHANCED: Added ActionScript 1.0/2.0 opcode decompilation for DoAction tags
 */
class AssetParsers {
  constructor() {
    this.dataTypes = new SWFDataTypes();
    this.as3Parser = new AS3Parsers();
    
    // ActionScript 1.0/2.0 Opcode definitions
    this.actionCodes = {
      0x00: "End",
      0x04: "NextFrame", 
      0x05: "PreviousFrame",
      0x06: "Play",
      0x07: "Stop",
      0x08: "ToggleQuality",
      0x09: "StopSounds",
      0x0A: "Add",
      0x0B: "Subtract", 
      0x0C: "Multiply",
      0x0D: "Divide",
      0x0E: "Equals",
      0x0F: "Less",
      0x10: "And",
      0x11: "Or",
      0x12: "Not",
      0x13: "StringEquals",
      0x14: "StringLength",
      0x15: "StringExtract",
      0x17: "Pop",
      0x18: "ToInteger",
      0x1C: "GetVariable",
      0x1D: "SetVariable",
      0x20: "SetTarget2",
      0x21: "StringAdd",
      0x22: "GetProperty",
      0x23: "SetProperty",
      0x24: "CloneSprite",
      0x25: "RemoveSprite",
      0x26: "Trace",
      0x27: "StartDrag",
      0x28: "EndDrag",
      0x29: "StringLess",
      0x2A: "Throw",
      0x2B: "CastOp",
      0x2C: "ImplementsOp",
      0x30: "RandomNumber",
      0x31: "MBStringLength",
      0x32: "CharToAscii",
      0x33: "AsciiToChar",
      0x34: "GetTime",
      0x35: "MBStringExtract",
      0x36: "MBCharToAscii",
      0x37: "MBAsciiToChar",
      0x3A: "Delete",
      0x3B: "Delete2",
      0x3C: "DefineLocal",
      0x3D: "CallFunction",
      0x3E: "Return",
      0x3F: "Modulo",
      0x40: "NewObject",
      0x41: "DefineLocal2",
      0x42: "InitArray",
      0x43: "InitObject",
      0x44: "TypeOf",
      0x45: "TargetPath",
      0x46: "Enumerate",
      0x47: "Add2",
      0x48: "Less2",
      0x49: "Equals2",
      0x4A: "ToNumber",
      0x4B: "ToString",
      0x4C: "PushDuplicate",
      0x4D: "StackSwap",
      0x4E: "GetMember",
      0x4F: "SetMember",
      0x50: "Increment",
      0x51: "Decrement",
      0x52: "CallMethod",
      0x53: "NewMethod",
      0x54: "InstanceOf",
      0x55: "Enumerate2",
      0x60: "BitAnd",
      0x61: "BitOr",
      0x62: "BitXor",
      0x63: "BitLShift",
      0x64: "BitRShift",
      0x65: "BitURShift",
      0x66: "StrictEquals",
      0x67: "Greater",
      0x68: "StringGreater",
      0x69: "Extends",
      // Actions with data
      0x81: "GotoFrame",
      0x83: "GetURL",
      0x87: "StoreRegister",
      0x88: "ConstantPool",
      0x8A: "WaitForFrame",
      0x8B: "SetTarget",
      0x8C: "GoToLabel",
      0x8D: "WaitForFrame2",
      0x8E: "DefineFunction2",
      0x8F: "Try",
      0x94: "With",
      0x96: "Push",
      0x99: "Jump",
      0x9A: "GetURL2",
      0x9B: "DefineFunction",
      0x9D: "If",
      0x9E: "Call",
      0x9F: "GotoFrame2"
    };
    
    // Push data types for ActionScript
    this.pushTypes = {
      0: "String",
      1: "Float",
      2: "null", 
      3: "undefined",
      4: "Register",
      5: "Boolean",
      6: "Double",
      7: "Integer",
      8: "Constant8",
      9: "Constant16"
    };
  }
  
  // ==================== TAG PARSING DISPATCHER ====================
  
  parseTag(tagType, tagData, offset, length) {
    const reader = new BitReader(tagData, offset);
    
    switch (tagType) {
      case 12:
        return this.parseDoAction(reader, length);
      case 56:
        return this.parseExportAssets(reader, length);
      case 57:
        return this.parseImportAssets(reader, length);
      case 59:
        return this.parseDoInitAction(reader, length);
      case 71:
        return this.parseImportAssets2(reader, length);
      case 76:
        return this.parseSymbolClass(reader, length);
      case 82:
        return this.as3Parser.parseDoABC(reader, length);
      default:
        return this.parseUnknownAssetTag(tagType, reader, length);
    }
  }
  
  // ==================== ACTIONSCRIPT PARSING ====================
  
  parseDoAction(reader, length) {
    try {
      const actions = this.parseActionScript(reader, length);
      
      return {
        tagType: "DoAction",
        description: "Defines ActionScript code to execute",
        data: {
          actionCount: actions.length,
          actions: actions,
          complexity: this.analyzeActionComplexity(actions),
          hasInteractivity: this.hasInteractiveActions(actions),
          usedFeatures: this.getUsedActionFeatures(actions)
        }
      };
      
    } catch (error) {
      return {
        tagType: "DoAction",
        description: "Defines ActionScript code to execute",
        error: `ActionScript parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseActionScript(reader, length) {
    const actions = [];
    const startOffset = reader.byteOffset;
    let actionIndex = 0;
    
    while (reader.byteOffset < startOffset + length && actionIndex < 200) {
      try {
        const actionCode = this.dataTypes.parseUI8(reader);
        
        if (actionCode === 0x00) {
          // End action
          actions.push({
            index: actionIndex,
            opcode: actionCode,
            name: "End",
            description: "End of ActionScript block",
            data: null
          });
          break;
        }
        
        const actionName = this.actionCodes[actionCode] || `Unknown_0x${actionCode.toString(16).toUpperCase()}`;
        let actionData = null;
        let description = actionName;
        
        // Actions with data (0x80 and above, except some exceptions)
        if (actionCode >= 0x80) {
          const dataLength = this.dataTypes.parseUI16(reader);
          
          if (dataLength > 0 && reader.byteOffset + dataLength <= reader.buffer.length) {
            actionData = this.parseActionData(reader, actionCode, dataLength);
            description = this.formatActionDescription(actionCode, actionName, actionData);
          } else if (dataLength > 0) {
            // Data extends beyond buffer
            description = `${actionName} (data truncated: ${dataLength} bytes)`;
          }
        } else {
          // Simple actions without data
          description = this.getSimpleActionDescription(actionCode, actionName);
        }
        
        actions.push({
          index: actionIndex,
          opcode: actionCode,
          name: actionName,
          description: description,
          data: actionData
        });
        
        actionIndex++;
        
      } catch (error) {
        actions.push({
          index: actionIndex,
          opcode: null,
          name: "ParseError",
          description: `Parse error: ${error.message}`,
          data: null
        });
        break;
      }
    }
    
    return actions;
  }
  
  parseActionData(reader, actionCode, dataLength) {
    const startOffset = reader.byteOffset;
    
    try {
      switch (actionCode) {
        case 0x81: // GotoFrame
          return {
            frame: this.dataTypes.parseUI16(reader)
          };
          
        case 0x83: // GetURL
          const url = this.dataTypes.parseString(reader);
          const target = this.dataTypes.parseString(reader);
          return { url: url, target: target };
          
        case 0x87: // StoreRegister
          return {
            register: this.dataTypes.parseUI8(reader)
          };
          
        case 0x88: // ConstantPool
          const count = this.dataTypes.parseUI16(reader);
          const constants = [];
          for (let i = 0; i < Math.min(count, 50); i++) {
            constants.push(this.dataTypes.parseString(reader));
          }
          return {
            count: count,
            constants: constants,
            truncated: count > 50
          };
          
        case 0x8B: // SetTarget
          return {
            targetName: this.dataTypes.parseString(reader)
          };
          
        case 0x8C: // GoToLabel
          return {
            label: this.dataTypes.parseString(reader)
          };
          
        case 0x96: // Push
          return this.parsePushData(reader, dataLength);
          
        case 0x99: // Jump
          return {
            branchOffset: this.dataTypes.parseUI16(reader)
          };
          
        case 0x9A: // GetURL2
          const method = this.dataTypes.parseUI8(reader);
          return {
            method: method,
            methodName: this.getURL2Method(method)
          };
          
        case 0x9D: // If
          return {
            branchOffset: this.dataTypes.parseUI16(reader)
          };
          
        case 0x9F: // GotoFrame2
          const flags = this.dataTypes.parseUI8(reader);
          const result = {
            flags: flags,
            sceneBiasFlag: (flags & 0x01) !== 0,
            playFlag: (flags & 0x02) !== 0
          };
          if (result.sceneBiasFlag) {
            result.sceneBias = this.dataTypes.parseUI16(reader);
          }
          return result;
          
        default:
          // Generic data reading for unknown actions
          const data = [];
          const bytesToRead = Math.min(dataLength, 32);
          for (let i = 0; i < bytesToRead; i++) {
            data.push(this.dataTypes.parseUI8(reader));
          }
          return {
            rawData: data,
            totalLength: dataLength,
            truncated: dataLength > 32
          };
      }
      
    } catch (error) {
      return {
        parseError: error.message,
        dataLength: dataLength
      };
    } finally {
      // Ensure we advance by the correct amount even if parsing failed
      reader.byteOffset = startOffset + dataLength;
    }
  }
  
  parsePushData(reader, dataLength) {
    const values = [];
    const endOffset = reader.byteOffset + dataLength;
    
    while (reader.byteOffset < endOffset && values.length < 20) {
      try {
        const type = this.dataTypes.parseUI8(reader);
        const typeName = this.pushTypes[type] || `Unknown_${type}`;
        
        let value = null;
        
        switch (type) {
          case 0: // String
            value = this.dataTypes.parseString(reader);
            break;
          case 1: // Float
            value = this.dataTypes.parseFIXED(reader);
            break;
          case 2: // null
            value = null;
            break;
          case 3: // undefined
            value = undefined;
            break;
          case 4: // Register
            value = this.dataTypes.parseUI8(reader);
            break;
          case 5: // Boolean
            value = this.dataTypes.parseUI8(reader) !== 0;
            break;
          case 6: // Double
            // Double parsing is complex, simplified here
            const low = this.dataTypes.parseUI32(reader);
            const high = this.dataTypes.parseUI32(reader);
            value = `Double(0x${high.toString(16)}${low.toString(16)})`;
            break;
          case 7: // Integer
            value = this.dataTypes.parseUI32(reader);
            break;
          case 8: // Constant8
            value = this.dataTypes.parseUI8(reader);
            break;
          case 9: // Constant16
            value = this.dataTypes.parseUI16(reader);
            break;
          default:
            value = `Unknown(${type})`;
            break;
        }
        
        values.push({
          type: typeName,
          value: value,
          formatted: this.formatPushValue(typeName, value)
        });
        
      } catch (error) {
        values.push({
          type: "ParseError",
          value: null,
          formatted: `Error: ${error.message}`
        });
        break;
      }
    }
    
    return {
      values: values,
      count: values.length,
      truncated: reader.byteOffset < endOffset
    };
  }
  
  // ==================== ACTION FORMATTING ====================
  
  formatActionDescription(actionCode, actionName, actionData) {
    if (!actionData) return actionName;
    
    switch (actionCode) {
      case 0x81: // GotoFrame
        return `GotoFrame ${actionData.frame}`;
        
      case 0x83: // GetURL
        return `GetURL "${actionData.url}" target:"${actionData.target}"`;
        
      case 0x87: // StoreRegister
        return `StoreRegister $${actionData.register}`;
        
      case 0x88: // ConstantPool
        const constList = actionData.constants.slice(0, 3).map(c => `"${c}"`).join(", ");
        return `ConstantPool [${constList}${actionData.truncated ? "..." : ""}] (${actionData.count} total)`;
        
      case 0x8B: // SetTarget
        return `SetTarget "${actionData.targetName}"`;
        
      case 0x8C: // GoToLabel
        return `GoToLabel "${actionData.label}"`;
        
      case 0x96: // Push
        if (actionData.values && actionData.values.length > 0) {
          const firstValue = actionData.values[0];
          if (actionData.values.length === 1) {
            return `Push ${firstValue.formatted}`;
          } else {
            return `Push ${firstValue.formatted} (+${actionData.values.length - 1} more)`;
          }
        }
        return "Push (empty)";
        
      case 0x99: // Jump
        return `Jump +${actionData.branchOffset}`;
        
      case 0x9A: // GetURL2
        return `GetURL2 method:${actionData.methodName}`;
        
      case 0x9D: // If
        return `If (jump +${actionData.branchOffset})`;
        
      case 0x9F: // GotoFrame2
        let desc = "GotoFrame2";
        if (actionData.playFlag) desc += " (play)";
        if (actionData.sceneBiasFlag) desc += ` scene:${actionData.sceneBias}`;
        return desc;
        
      default:
        return actionName;
    }
  }
  
  getSimpleActionDescription(actionCode, actionName) {
    const descriptions = {
      0x04: "NextFrame - Advance to next frame",
      0x05: "PreviousFrame - Go back one frame", 
      0x06: "Play - Start playback",
      0x07: "Stop - Stop playback",
      0x08: "ToggleQuality - Toggle rendering quality",
      0x09: "StopSounds - Stop all sounds",
      0x0A: "Add - Pop two values, push sum",
      0x0B: "Subtract - Pop two values, push difference",
      0x0C: "Multiply - Pop two values, push product",
      0x0D: "Divide - Pop two values, push quotient",
      0x0E: "Equals - Pop two values, push equality",
      0x0F: "Less - Pop two values, push comparison",
      0x10: "And - Pop two values, push logical AND",
      0x11: "Or - Pop two values, push logical OR",
      0x12: "Not - Pop value, push logical NOT",
      0x1C: "GetVariable - Pop name, push variable value",
      0x1D: "SetVariable - Pop value and name, set variable",
      0x26: "Trace - Pop value and output to trace",
      0x3D: "CallFunction - Call function with arguments",
      0x3E: "Return - Return from function"
    };
    
    return descriptions[actionCode] || actionName;
  }
  
  formatPushValue(typeName, value) {
    switch (typeName) {
      case "String":
        return `"${value}"`;
      case "Float":
      case "Double":
      case "Integer":
        return `${value}`;
      case "Boolean":
        return value ? "true" : "false";
      case "null":
        return "null";
      case "undefined":
        return "undefined";
      case "Register":
        return `$${value}`;
      case "Constant8":
      case "Constant16":
        return `const[${value}]`;
      default:
        return String(value);
    }
  }
  
  getURL2Method(method) {
    const methods = {
      0: "None",
      1: "GET", 
      2: "POST"
    };
    return methods[method] || `Unknown(${method})`;
  }
  
  // ==================== ACTION ANALYSIS ====================
  
  analyzeActionComplexity(actions) {
    if (actions.length === 0) return "empty";
    if (actions.length <= 5) return "simple";
    if (actions.length <= 20) return "moderate";
    if (actions.length <= 50) return "complex";
    return "very_complex";
  }
  
  hasInteractiveActions(actions) {
    const interactiveOpcodes = new Set([0x83, 0x9A, 0x26, 0x3D, 0x1C, 0x1D]);
    return actions.some(action => interactiveOpcodes.has(action.opcode));
  }
  
  getUsedActionFeatures(actions) {
    const features = new Set();
    
    actions.forEach(action => {
      switch (action.opcode) {
        case 0x83:
        case 0x9A:
          features.add("URL Navigation");
          break;
        case 0x26:
          features.add("Debug Trace");
          break;
        case 0x81:
        case 0x8C:
        case 0x9F:
          features.add("Frame Control");
          break;
        case 0x06:
        case 0x07:
          features.add("Playback Control");
          break;
        case 0x1C:
        case 0x1D:
          features.add("Variables");
          break;
        case 0x3D:
        case 0x3E:
          features.add("Functions");
          break;
        case 0x99:
        case 0x9D:
          features.add("Conditional Logic");
          break;
        case 0x88:
          features.add("String Constants");
          break;
      }
    });
    
    return Array.from(features);
  }
  
  // ==================== OTHER ASSET TAG PARSERS ====================
  
  parseExportAssets(reader, length) {
    try {
      const count = this.dataTypes.parseUI16(reader);
      const assets = [];
      
      for (let i = 0; i < Math.min(count, 50); i++) {
        const characterId = this.dataTypes.parseUI16(reader);
        const name = this.dataTypes.parseString(reader);
        assets.push({
          characterId: characterId,
          name: name
        });
      }
      
      return {
        tagType: "ExportAssets",
        description: "Exports character definitions for use by other SWF files",
        data: {
          count: count,
          assets: assets,
          truncated: count > 50
        }
      };
      
    } catch (error) {
      return {
        tagType: "ExportAssets",
        description: "Exports character definitions for use by other SWF files",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseImportAssets(reader, length) {
    try {
      const url = this.dataTypes.parseString(reader);
      const count = this.dataTypes.parseUI16(reader);
      const assets = [];
      
      for (let i = 0; i < Math.min(count, 50); i++) {
        const characterId = this.dataTypes.parseUI16(reader);
        const name = this.dataTypes.parseString(reader);
        assets.push({
          characterId: characterId,
          name: name
        });
      }
      
      return {
        tagType: "ImportAssets",
        description: "Imports character definitions from another SWF file",
        data: {
          url: url,
          count: count,
          assets: assets,
          truncated: count > 50
        }
      };
      
    } catch (error) {
      return {
        tagType: "ImportAssets",
        description: "Imports character definitions from another SWF file",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseDoInitAction(reader, length) {
    try {
      const spriteId = this.dataTypes.parseUI16(reader);
      const remainingLength = length - 2;
      
      if (remainingLength > 0) {
        const actions = this.parseActionScript(reader, remainingLength);
        
        return {
          tagType: "DoInitAction",
          description: "Defines initialization ActionScript for a sprite",
          data: {
            spriteId: spriteId,
            actionCount: actions.length,
            actions: actions,
            complexity: this.analyzeActionComplexity(actions)
          }
        };
      } else {
        return {
          tagType: "DoInitAction",
          description: "Defines initialization ActionScript for a sprite",
          data: {
            spriteId: spriteId,
            actionCount: 0,
            actions: []
          }
        };
      }
      
    } catch (error) {
      return {
        tagType: "DoInitAction",
        description: "Defines initialization ActionScript for a sprite",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseImportAssets2(reader, length) {
    try {
      const url = this.dataTypes.parseString(reader);
      const reserved1 = this.dataTypes.parseUI8(reader);
      const reserved2 = this.dataTypes.parseUI8(reader);
      const count = this.dataTypes.parseUI16(reader);
      const assets = [];
      
      for (let i = 0; i < Math.min(count, 50); i++) {
        const characterId = this.dataTypes.parseUI16(reader);
        const name = this.dataTypes.parseString(reader);
        assets.push({
          characterId: characterId,
          name: name
        });
      }
      
      return {
        tagType: "ImportAssets2",
        description: "Enhanced import of character definitions from another SWF file",
        data: {
          url: url,
          reserved1: reserved1,
          reserved2: reserved2,
          count: count,
          assets: assets,
          truncated: count > 50
        }
      };
      
    } catch (error) {
      return {
        tagType: "ImportAssets2",
        description: "Enhanced import of character definitions from another SWF file",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseSymbolClass(reader, length) {
    try {
      const count = this.dataTypes.parseUI16(reader);
      const symbols = [];
      
      for (let i = 0; i < Math.min(count, 50); i++) {
        const characterId = this.dataTypes.parseUI16(reader);
        const className = this.dataTypes.parseString(reader);
        symbols.push({
          characterId: characterId,
          className: className
        });
      }
      
      return {
        tagType: "SymbolClass",
        description: "Associates ActionScript 3.0 classes with character definitions",
        data: {
          count: count,
          symbols: symbols,
          truncated: count > 50
        }
      };
      
    } catch (error) {
      return {
        tagType: "SymbolClass",
        description: "Associates ActionScript 3.0 classes with character definitions",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseUnknownAssetTag(tagType, reader, length) {
    const data = [];
    const bytesToRead = Math.min(length, 32);
    
    for (let i = 0; i < bytesToRead; i++) {
      data.push(this.dataTypes.parseUI8(reader));
    }
    
    return {
      tagType: `Unknown Asset Tag ${tagType}`,
      description: "Unknown or unsupported asset-related tag",
      data: {
        rawBytes: data,
        totalLength: length,
        truncated: length > 32,
        note: length > 32 ? "Data truncated to first 32 bytes" : "Complete data shown"
      }
    };
  }
}

// Export for use by other parsers
window.AssetParsers = AssetParsers;
