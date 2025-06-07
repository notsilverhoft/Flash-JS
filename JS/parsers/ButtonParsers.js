/* 
 * SWF Button Definition Tags Parser - v1.0
 * Handles interactive button definitions with multiple states and actions
 * DefineButton (Tag 7), DefineButton2 (Tag 34), DefineButtonCxform (Tag 23)
 * Essential for Flash interactivity and user interface elements
 */
class ButtonParsers {
  constructor() {
    this.dataTypes = new SWFDataTypes();
  }
  
  // ==================== TAG PARSING DISPATCHER ====================
  
  parseTag(tagType, tagData, offset, length) {
    const reader = new BitReader(tagData, offset);
    
    switch (tagType) {
      case 7:
        return this.parseDefineButton(reader, length);
      case 23:
        return this.parseDefineButtonCxform(reader, length);
      case 34:
        return this.parseDefineButton2(reader, length);
      default:
        return this.parseUnknownButtonTag(tagType, reader, length);
    }
  }
  
  // ==================== SPECIFIC TAG PARSERS ====================
  
  parseDefineButton(reader, length) {
    try {
      // DefineButton format:
      // - ButtonId (UI16)
      // - ButtonRecords (BUTTONRECORD[]) - ended by record with all flags = 0
      // - ActionScript (UI8[remaining])
      
      const buttonId = this.dataTypes.parseUI16(reader);
      
      // Parse button records
      const buttonRecords = this.parseButtonRecords(reader, 1); // version 1
      
      // Calculate remaining bytes for ActionScript
      let actionScriptLength = 0;
      if (buttonRecords.bytesConsumed) {
        actionScriptLength = length - 2 - buttonRecords.bytesConsumed; // ButtonId + ButtonRecords
      }
      
      // Parse ActionScript (simplified analysis)
      let actionScript = null;
      if (actionScriptLength > 0) {
        actionScript = this.parseActionScript(reader, actionScriptLength);
      }
      
      return {
        tagType: "DefineButton",
        description: "Defines an interactive button with multiple states",
        data: {
          buttonId: buttonId,
          states: buttonRecords.states,
          stateCount: buttonRecords.totalStates,
          actionScript: actionScript,
          hasActionScript: actionScriptLength > 0,
          version: 1,
          complexity: this.calculateButtonComplexity(buttonRecords, actionScript)
        }
      };
      
    } catch (error) {
      return {
        tagType: "DefineButton",
        description: "Defines an interactive button with multiple states",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseDefineButton2(reader, length) {
    try {
      // DefineButton2 format:
      // - ButtonId (UI16)
      // - ReservedFlags (UB[7])
      // - TrackAsMenu (UB[1])
      // - ActionOffset (UI16)
      // - ButtonRecords (BUTTONRECORD[])
      // - Actions (BUTTONCONDACTION[])
      
      const buttonId = this.dataTypes.parseUI16(reader);
      
      const flagsByte = this.dataTypes.parseUI8(reader);
      const trackAsMenu = (flagsByte & 0x01) !== 0;
      
      const actionOffset = this.dataTypes.parseUI16(reader);
      
      // Parse button records
      const buttonRecords = this.parseButtonRecords(reader, 2); // version 2
      
      // Parse button actions if present
      let buttonActions = null;
      if (actionOffset > 0) {
        const actionsLength = length - actionOffset;
        buttonActions = this.parseButtonCondActions(reader, actionsLength);
      }
      
      return {
        tagType: "DefineButton2",
        description: "Defines an enhanced interactive button with conditional actions",
        data: {
          buttonId: buttonId,
          trackAsMenu: trackAsMenu,
          actionOffset: actionOffset,
          states: buttonRecords.states,
          stateCount: buttonRecords.totalStates,
          buttonActions: buttonActions,
          hasConditionalActions: actionOffset > 0,
          version: 2,
          complexity: this.calculateButtonComplexity(buttonRecords, buttonActions)
        }
      };
      
    } catch (error) {
      return {
        tagType: "DefineButton2",
        description: "Defines an enhanced interactive button with conditional actions",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseDefineButtonCxform(reader, length) {
    try {
      // DefineButtonCxform format:
      // - ButtonId (UI16)
      // - ButtonColorTransform (CXFORM)
      
      const buttonId = this.dataTypes.parseUI16(reader);
      const colorTransform = this.dataTypes.parseCXFORM(reader);
      
      return {
        tagType: "DefineButtonCxform",
        description: "Defines color transform for a button",
        data: {
          buttonId: buttonId,
          colorTransform: colorTransform,
          hasMultiplyTerms: colorTransform.redMultTerm !== 256 || 
                            colorTransform.greenMultTerm !== 256 || 
                            colorTransform.blueMultTerm !== 256,
          hasAddTerms: colorTransform.redAddTerm !== 0 || 
                       colorTransform.greenAddTerm !== 0 || 
                       colorTransform.blueAddTerm !== 0,
          transformType: this.analyzeColorTransform(colorTransform)
        }
      };
      
    } catch (error) {
      return {
        tagType: "DefineButtonCxform",
        description: "Defines color transform for a button",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseUnknownButtonTag(tagType, reader, length) {
    const data = [];
    const bytesToRead = Math.min(length, 32);
    
    for (let i = 0; i < bytesToRead; i++) {
      data.push(this.dataTypes.parseUI8(reader));
    }
    
    return {
      tagType: `Unknown Button Tag ${tagType}`,
      description: "Unknown or unsupported button definition tag",
      data: {
        rawBytes: data,
        totalLength: length,
        truncated: length > 32,
        note: length > 32 ? "Data truncated to first 32 bytes" : "Complete data shown"
      }
    };
  }
  
  // ==================== BUTTON RECORD PARSING ====================
  
  parseButtonRecords(reader, version) {
    const records = [];
    const states = {
      up: [],
      over: [],
      down: [],
      hitTest: []
    };
    let bytesConsumed = 0;
    let recordIndex = 0;
    
    try {
      while (recordIndex < 100) { // Prevent infinite loops
        // Read button record header
        const recordByte = this.dataTypes.parseUI8(reader);
        bytesConsumed += 1;
        
        // Check for end of records (all flags = 0)
        if (recordByte === 0) {
          break;
        }
        
        // Parse button state flags
        const stateUp = (recordByte & 0x01) !== 0;
        const stateOver = (recordByte & 0x02) !== 0;
        const stateDown = (recordByte & 0x04) !== 0;
        const stateHitTest = (recordByte & 0x08) !== 0;
        
        // Parse character data
        const characterId = this.dataTypes.parseUI16(reader);
        const placeDepth = this.dataTypes.parseUI16(reader);
        const placeMatrix = this.dataTypes.parseMATRIX(reader);
        bytesConsumed += 4; // CharacterId + PlaceDepth
        
        // Estimate matrix bytes consumed (approximate)
        bytesConsumed += this.estimateMatrixBytes(placeMatrix);
        
        let colorTransform = null;
        if (version >= 2) {
          try {
            colorTransform = this.dataTypes.parseCXFORMA(reader);
            bytesConsumed += 8; // Approximate CXFORMA size
          } catch (e) {
            // Color transform parsing failed, continue without it
          }
        }
        
        const record = {
          index: recordIndex,
          characterId: characterId,
          placeDepth: placeDepth,
          placeMatrix: placeMatrix,
          matrixFormatted: this.dataTypes.formatMatrix(placeMatrix),
          colorTransform: colorTransform,
          states: {
            up: stateUp,
            over: stateOver,
            down: stateDown,
            hitTest: stateHitTest
          },
          activeStates: this.getActiveStates(stateUp, stateOver, stateDown, stateHitTest)
        };
        
        // Add to state collections
        if (stateUp) states.up.push(record);
        if (stateOver) states.over.push(record);
        if (stateDown) states.down.push(record);
        if (stateHitTest) states.hitTest.push(record);
        
        records.push(record);
        recordIndex++;
      }
      
    } catch (error) {
      return {
        records: records,
        states: states,
        totalStates: recordIndex,
        bytesConsumed: bytesConsumed,
        parseError: error.message,
        truncated: true
      };
    }
    
    return {
      records: records,
      states: states,
      totalStates: recordIndex,
      bytesConsumed: bytesConsumed,
      truncated: recordIndex >= 100
    };
  }
  
  parseActionScript(reader, length) {
    try {
      // Simple ActionScript analysis (similar to AssetParsers.js)
      const actionData = [];
      let bytesRead = 0;
      let actionCount = 0;
      
      while (bytesRead < length && actionCount < 25) {
        const actionCode = this.dataTypes.parseUI8(reader);
        actionData.push(actionCode);
        bytesRead++;
        actionCount++;
        
        // Actions >= 0x80 have additional length data
        if (actionCode >= 0x80 && bytesRead + 2 <= length) {
          const actionLength = this.dataTypes.parseUI16(reader);
          bytesRead += 2;
          
          // Skip action data
          for (let i = 0; i < actionLength && bytesRead < length; i++) {
            this.dataTypes.parseUI8(reader);
            bytesRead++;
          }
        }
      }
      
      return {
        totalBytes: length,
        actionCount: actionCount,
        firstActions: actionData.slice(0, 10).map(code => `0x${code.toString(16).padStart(2, '0')}`),
        truncated: actionCount >= 25 || bytesRead < length,
        hasComplexActions: actionData.some(code => code >= 0x80),
        note: "Button ActionScript detected - full decompilation not implemented"
      };
      
    } catch (error) {
      return {
        totalBytes: length,
        actionCount: 0,
        parseError: error.message,
        note: "ActionScript parse error"
      };
    }
  }
  
  parseButtonCondActions(reader, length) {
    try {
      const condActions = [];
      let bytesRead = 0;
      let actionIndex = 0;
      
      while (bytesRead < length && actionIndex < 20) { // Limit for performance
        if (bytesRead + 4 > length) break;
        
        const condActionSize = this.dataTypes.parseUI16(reader);
        const condKeyPress = this.dataTypes.parseUI8(reader);
        const condFlags = this.dataTypes.parseUI8(reader);
        bytesRead += 4;
        
        // Parse condition flags
        const conditions = {
          idleToOverUp: (condFlags & 0x01) !== 0,
          overUpToIdle: (condFlags & 0x02) !== 0,
          overUpToOverDown: (condFlags & 0x04) !== 0,
          overDownToOverUp: (condFlags & 0x08) !== 0,
          overDownToOutDown: (condFlags & 0x10) !== 0,
          outDownToOverDown: (condFlags & 0x20) !== 0,
          outDownToIdle: (condFlags & 0x40) !== 0,
          idleToOverDown: (condFlags & 0x80) !== 0,
          keyPress: condKeyPress > 0
        };
        
        // Skip the actual action data for now
        const actionDataSize = condActionSize > 0 ? condActionSize - 4 : 0;
        if (actionDataSize > 0 && bytesRead + actionDataSize <= length) {
          // Skip action data bytes
          for (let i = 0; i < actionDataSize; i++) {
            this.dataTypes.parseUI8(reader);
            bytesRead++;
          }
        }
        
        condActions.push({
          index: actionIndex,
          condActionSize: condActionSize,
          keyPress: condKeyPress,
          conditions: conditions,
          activeConditions: this.getActiveConditions(conditions),
          actionDataSize: actionDataSize
        });
        
        actionIndex++;
        
        // If condActionSize is 0, this is the last action
        if (condActionSize === 0) break;
      }
      
      return {
        actions: condActions,
        actionCount: actionIndex,
        truncated: actionIndex >= 20 || bytesRead < length
      };
      
    } catch (error) {
      return {
        actions: [],
        actionCount: 0,
        parseError: error.message
      };
    }
  }
  
  // ==================== UTILITY METHODS ====================
  
  getActiveStates(up, over, down, hitTest) {
    const active = [];
    if (up) active.push("up");
    if (over) active.push("over");
    if (down) active.push("down");
    if (hitTest) active.push("hitTest");
    return active;
  }
  
  getActiveConditions(conditions) {
    const active = [];
    if (conditions.idleToOverUp) active.push("idle→over");
    if (conditions.overUpToIdle) active.push("over→idle");
    if (conditions.overUpToOverDown) active.push("over→down");
    if (conditions.overDownToOverUp) active.push("down→over");
    if (conditions.keyPress) active.push("keyPress");
    return active;
  }
  
  estimateMatrixBytes(matrix) {
    // Rough estimation of matrix bit consumption
    let bits = 1; // HasScale
    if (matrix.scaleX !== 1.0 || matrix.scaleY !== 1.0) {
      bits += 5 + 32; // NScaleBits + scale values
    }
    bits += 1; // HasRotate
    if (matrix.rotateSkew0 !== 0.0 || matrix.rotateSkew1 !== 0.0) {
      bits += 5 + 32; // NRotateBits + rotate values
    }
    bits += 5 + 32; // NTranslateBits + translate values
    return Math.ceil(bits / 8);
  }
  
  analyzeColorTransform(transform) {
    const hasMultiply = transform.redMultTerm !== 256 || 
                       transform.greenMultTerm !== 256 || 
                       transform.blueMultTerm !== 256;
    const hasAdd = transform.redAddTerm !== 0 || 
                   transform.greenAddTerm !== 0 || 
                   transform.blueAddTerm !== 0;
    
    if (hasMultiply && hasAdd) return "multiply_and_add";
    if (hasMultiply) return "multiply_only";
    if (hasAdd) return "add_only";
    return "identity";
  }
  
  calculateButtonComplexity(buttonRecords, actionData) {
    const stateCount = buttonRecords.totalStates || 0;
    const hasActions = actionData && (actionData.actionCount > 0 || actionData.totalBytes > 0);
    const hasConditionalActions = actionData && actionData.actions && actionData.actions.length > 0;
    
    let complexity = "simple";
    
    if (stateCount > 10 || hasConditionalActions) {
      complexity = "complex";
    } else if (stateCount > 3 || hasActions) {
      complexity = "moderate";
    }
    
    return {
      level: complexity,
      stateCount: stateCount,
      hasActions: hasActions,
      hasConditionalActions: hasConditionalActions,
      details: hasConditionalActions ? "Multi-condition button" : 
               hasActions ? "Button with ActionScript" : "Simple button"
    };
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
        case "DefineButton":
        case "DefineButton2":
          lines.push(`  └─ Button ID: ${data.buttonId}`);
          lines.push(`  └─ Version: ${data.version}`);
          
          if (data.states) {
            lines.push(`  └─ Button States:`);
            lines.push(`    • Up state: ${data.states.up.length} objects`);
            lines.push(`    • Over state: ${data.states.over.length} objects`);
            lines.push(`    • Down state: ${data.states.down.length} objects`);
            lines.push(`    • Hit test: ${data.states.hitTest.length} objects`);
          }
          
          if (data.complexity) {
            lines.push(`  └─ Complexity: ${data.complexity.level} (${data.complexity.details})`);
          }
          
          if (data.trackAsMenu !== undefined) {
            lines.push(`  └─ Track as Menu: ${data.trackAsMenu ? 'Yes' : 'No'}`);
          }
          
          if (data.hasActionScript) {
            lines.push(`  └─ Has ActionScript: Yes`);
          }
          
          if (data.hasConditionalActions) {
            lines.push(`  └─ Has Conditional Actions: Yes`);
          }
          break;
          
        case "DefineButtonCxform":
          lines.push(`  └─ Button ID: ${data.buttonId}`);
          lines.push(`  └─ Transform Type: ${data.transformType}`);
          if (data.hasMultiplyTerms) {
            lines.push(`  └─ Has Color Multiplication: Yes`);
          }
          if (data.hasAddTerms) {
            lines.push(`  └─ Has Color Addition: Yes`);
          }
          break;
      }
    }
    
    return lines.join('\n');
  }
}

// Export for use by other parsers
window.ButtonParsers = ButtonParsers;
