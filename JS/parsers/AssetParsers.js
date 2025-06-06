/* 
 * SWF Asset Management Tags Parser - v1.0
 * Handles asset definition, export, import, and ActionScript binding tags
 * Critical for understanding SWF architecture and dependencies
 */
class AssetParsers {
  constructor() {
    this.dataTypes = new SWFDataTypes();
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
        return this.parseDoABC(reader, length);
      default:
        return this.parseUnknownAssetTag(tagType, reader, length);
    }
  }
  
  // ==================== SPECIFIC TAG PARSERS ====================
  
  parseDoAction(reader, length) {
    try {
      if (length === 0) {
        return {
          tagType: "DoAction",
          description: "Executes ActionScript 1/2 code",
          error: "No ActionScript data provided",
          data: {}
        };
      }
      
      // Read the ActionScript bytecode (we won't fully decompile, just analyze structure)
      const actionData = [];
      let bytesRead = 0;
      let actionCount = 0;
      
      while (bytesRead < length && actionCount < 50) { // Limit to prevent overwhelming output
        const actionCode = this.dataTypes.parseUI8(reader);
        actionData.push(actionCode);
        bytesRead++;
        actionCount++;
        
        // Some actions have additional data
        if (actionCode >= 0x80) {
          // Actions >= 0x80 have a length field
          if (bytesRead + 2 <= length) {
            const actionLength = this.dataTypes.parseUI16(reader);
            bytesRead += 2;
            
            // Skip the action data for now
            for (let i = 0; i < actionLength && bytesRead < length; i++) {
              this.dataTypes.parseUI8(reader);
              bytesRead++;
            }
          }
        }
      }
      
      return {
        tagType: "DoAction",
        description: "Executes ActionScript 1/2 code",
        data: {
          totalBytes: length,
          actionCount: actionCount,
          firstActions: actionData.slice(0, 10).map(code => `0x${code.toString(16).padStart(2, '0')}`),
          truncated: actionCount >= 50 || bytesRead < length,
          note: "ActionScript bytecode detected - full decompilation not implemented",
          hasComplexActions: actionData.some(code => code >= 0x80)
        }
      };
      
    } catch (error) {
      return {
        tagType: "DoAction",
        description: "Executes ActionScript 1/2 code",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseExportAssets(reader, length) {
    try {
      if (length < 2) {
        return {
          tagType: "ExportAssets",
          description: "Exports assets for external use",
          error: "Insufficient data for asset count",
          data: {}
        };
      }
      
      const assetCount = this.dataTypes.parseUI16(reader);
      const assets = [];
      
      for (let i = 0; i < assetCount; i++) {
        try {
          const characterId = this.dataTypes.parseUI16(reader);
          const name = this.dataTypes.parseSTRING(reader);
          assets.push({ characterId, name });
        } catch (e) {
          // If we can't parse more assets, break
          break;
        }
      }
      
      return {
        tagType: "ExportAssets",
        description: "Exports assets for external use",
        data: {
          assetCount: assetCount,
          assets: assets,
          parsedAssets: assets.length,
          complete: assets.length === assetCount,
          exportedNames: assets.map(asset => asset.name)
        }
      };
      
    } catch (error) {
      return {
        tagType: "ExportAssets",
        description: "Exports assets for external use",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseImportAssets(reader, length) {
    try {
      if (length < 2) {
        return {
          tagType: "ImportAssets",
          description: "Imports assets from external SWF",
          error: "Insufficient data",
          data: {}
        };
      }
      
      const url = this.dataTypes.parseSTRING(reader);
      const assetCount = this.dataTypes.parseUI16(reader);
      const assets = [];
      
      for (let i = 0; i < assetCount; i++) {
        try {
          const characterId = this.dataTypes.parseUI16(reader);
          const name = this.dataTypes.parseSTRING(reader);
          assets.push({ characterId, name });
        } catch (e) {
          break;
        }
      }
      
      return {
        tagType: "ImportAssets",
        description: "Imports assets from external SWF",
        data: {
          url: url,
          assetCount: assetCount,
          assets: assets,
          parsedAssets: assets.length,
          complete: assets.length === assetCount,
          importedNames: assets.map(asset => asset.name)
        }
      };
      
    } catch (error) {
      return {
        tagType: "ImportAssets",
        description: "Imports assets from external SWF",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseDoInitAction(reader, length) {
    try {
      if (length < 2) {
        return {
          tagType: "DoInitAction",
          description: "Executes initialization ActionScript for a sprite",
          error: "Insufficient data",
          data: {}
        };
      }
      
      const spriteId = this.dataTypes.parseUI16(reader);
      const actionLength = length - 2;
      
      // Similar to DoAction, analyze structure without full decompilation
      const actionData = [];
      let bytesRead = 0;
      let actionCount = 0;
      
      while (bytesRead < actionLength && actionCount < 25) {
        const actionCode = this.dataTypes.parseUI8(reader);
        actionData.push(actionCode);
        bytesRead++;
        actionCount++;
        
        if (actionCode >= 0x80 && bytesRead + 2 <= actionLength) {
          const actionSubLength = this.dataTypes.parseUI16(reader);
          bytesRead += 2;
          
          for (let i = 0; i < actionSubLength && bytesRead < actionLength; i++) {
            this.dataTypes.parseUI8(reader);
            bytesRead++;
          }
        }
      }
      
      return {
        tagType: "DoInitAction",
        description: "Executes initialization ActionScript for a sprite",
        data: {
          spriteId: spriteId,
          actionBytes: actionLength,
          actionCount: actionCount,
          firstActions: actionData.slice(0, 8).map(code => `0x${code.toString(16).padStart(2, '0')}`),
          truncated: actionCount >= 25 || bytesRead < actionLength,
          note: "Initialization ActionScript for sprite " + spriteId
        }
      };
      
    } catch (error) {
      return {
        tagType: "DoInitAction",
        description: "Executes initialization ActionScript for a sprite",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseImportAssets2(reader, length) {
    try {
      if (length < 3) {
        return {
          tagType: "ImportAssets2",
          description: "Imports assets from external SWF (Flash 8+)",
          error: "Insufficient data",
          data: {}
        };
      }
      
      const url = this.dataTypes.parseSTRING(reader);
      const reserved1 = this.dataTypes.parseUI8(reader);
      const reserved2 = this.dataTypes.parseUI8(reader);
      const assetCount = this.dataTypes.parseUI16(reader);
      const assets = [];
      
      for (let i = 0; i < assetCount; i++) {
        try {
          const characterId = this.dataTypes.parseUI16(reader);
          const name = this.dataTypes.parseSTRING(reader);
          assets.push({ characterId, name });
        } catch (e) {
          break;
        }
      }
      
      return {
        tagType: "ImportAssets2",
        description: "Imports assets from external SWF (Flash 8+)",
        data: {
          url: url,
          reserved1: reserved1,
          reserved2: reserved2,
          assetCount: assetCount,
          assets: assets,
          parsedAssets: assets.length,
          complete: assets.length === assetCount,
          importedNames: assets.map(asset => asset.name),
          note: "Enhanced import format for Flash 8+"
        }
      };
      
    } catch (error) {
      return {
        tagType: "ImportAssets2",
        description: "Imports assets from external SWF (Flash 8+)",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseSymbolClass(reader, length) {
    try {
      if (length < 2) {
        return {
          tagType: "SymbolClass",
          description: "Maps symbols to ActionScript 3 classes",
          error: "Insufficient data",
          data: {}
        };
      }
      
      const symbolCount = this.dataTypes.parseUI16(reader);
      const symbols = [];
      
      for (let i = 0; i < symbolCount; i++) {
        try {
          const characterId = this.dataTypes.parseUI16(reader);
          const className = this.dataTypes.parseSTRING(reader);
          symbols.push({ characterId, className });
        } catch (e) {
          break;
        }
      }
      
      return {
        tagType: "SymbolClass",
        description: "Maps symbols to ActionScript 3 classes",
        data: {
          symbolCount: symbolCount,
          symbols: symbols,
          parsedSymbols: symbols.length,
          complete: symbols.length === symbolCount,
          classNames: symbols.map(symbol => symbol.className),
          hasMainClass: symbols.some(symbol => symbol.characterId === 0),
          mainClass: symbols.find(symbol => symbol.characterId === 0)?.className || null
        }
      };
      
    } catch (error) {
      return {
        tagType: "SymbolClass",
        description: "Maps symbols to ActionScript 3 classes",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseDoABC(reader, length) {
    try {
      if (length < 5) {
        return {
          tagType: "DoABC",
          description: "Contains ActionScript 3 bytecode (ABC format)",
          error: "Insufficient data",
          data: {}
        };
      }
      
      const flags = this.dataTypes.parseUI32(reader);
      const name = this.dataTypes.parseSTRING(reader);
      const abcDataLength = length - 4 - (name.length + 1);
      
      // Read first few bytes of ABC data for analysis
      const abcHeader = [];
      const bytesToRead = Math.min(16, abcDataLength);
      
      for (let i = 0; i < bytesToRead; i++) {
        abcHeader.push(this.dataTypes.parseUI8(reader));
      }
      
      return {
        tagType: "DoABC",
        description: "Contains ActionScript 3 bytecode (ABC format)",
        data: {
          flags: flags,
          name: name,
          abcDataLength: abcDataLength,
          abcHeader: abcHeader.map(byte => `0x${byte.toString(16).padStart(2, '0')}`),
          isLazyInitialize: (flags & 0x01) !== 0,
          note: "ActionScript 3 ABC bytecode - full decompilation not implemented",
          hasName: name.length > 0
        }
      };
      
    } catch (error) {
      return {
        tagType: "DoABC",
        description: "Contains ActionScript 3 bytecode (ABC format)",
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
      description: "Unknown or unsupported asset management tag",
      data: {
        rawBytes: data,
        totalLength: length,
        truncated: length > 32,
        note: length > 32 ? "Data truncated to first 32 bytes" : "Complete data shown"
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
        case "DoAction":
          if (parsedTag.data.actionCount) {
            lines.push(`  └─ Actions Found: ${parsedTag.data.actionCount}`);
            lines.push(`  └─ Total Bytes: ${parsedTag.data.totalBytes}`);
            if (parsedTag.data.hasComplexActions) {
              lines.push(`  └─ Contains Complex Actions: Yes`);
            }
            if (parsedTag.data.firstActions && parsedTag.data.firstActions.length > 0) {
              lines.push(`  └─ First Action Codes: ${parsedTag.data.firstActions.join(', ')}`);
            }
          }
          break;
          
        case "ExportAssets":
          lines.push(`  └─ Assets Exported: ${parsedTag.data.parsedAssets}/${parsedTag.data.assetCount}`);
          if (parsedTag.data.exportedNames && parsedTag.data.exportedNames.length > 0) {
            lines.push(`  └─ Asset Names:`);
            parsedTag.data.exportedNames.slice(0, 5).forEach(name => {
              lines.push(`    • "${name}"`);
            });
            if (parsedTag.data.exportedNames.length > 5) {
              lines.push(`    • ... and ${parsedTag.data.exportedNames.length - 5} more`);
            }
          }
          break;
          
        case "ImportAssets":
        case "ImportAssets2":
          lines.push(`  └─ Import URL: "${parsedTag.data.url}"`);
          lines.push(`  └─ Assets Imported: ${parsedTag.data.parsedAssets}/${parsedTag.data.assetCount}`);
          if (parsedTag.data.importedNames && parsedTag.data.importedNames.length > 0) {
            lines.push(`  └─ Asset Names:`);
            parsedTag.data.importedNames.slice(0, 3).forEach(name => {
              lines.push(`    • "${name}"`);
            });
            if (parsedTag.data.importedNames.length > 3) {
              lines.push(`    • ... and ${parsedTag.data.importedNames.length - 3} more`);
            }
          }
          break;
          
        case "DoInitAction":
          lines.push(`  └─ Target Sprite ID: ${parsedTag.data.spriteId}`);
          lines.push(`  └─ Action Bytes: ${parsedTag.data.actionBytes}`);
          lines.push(`  └─ Actions Found: ${parsedTag.data.actionCount}`);
          break;
          
        case "SymbolClass":
          lines.push(`  └─ Symbol Mappings: ${parsedTag.data.parsedSymbols}/${parsedTag.data.symbolCount}`);
          if (parsedTag.data.mainClass) {
            lines.push(`  └─ Main Class: "${parsedTag.data.mainClass}"`);
          }
          if (parsedTag.data.classNames && parsedTag.data.classNames.length > 0) {
            lines.push(`  └─ Classes:`);
            parsedTag.data.classNames.slice(0, 4).forEach(className => {
              lines.push(`    • ${className}`);
            });
            if (parsedTag.data.classNames.length > 4) {
              lines.push(`    • ... and ${parsedTag.data.classNames.length - 4} more`);
            }
          }
          break;
          
        case "DoABC":
          lines.push(`  └─ ABC Name: "${parsedTag.data.name}"`);
          lines.push(`  └─ ABC Data Size: ${parsedTag.data.abcDataLength} bytes`);
          lines.push(`  └─ Lazy Initialize: ${parsedTag.data.isLazyInitialize ? 'Yes' : 'No'}`);
          if (parsedTag.data.abcHeader && parsedTag.data.abcHeader.length > 0) {
            lines.push(`  └─ ABC Header: ${parsedTag.data.abcHeader.slice(0, 8).join(' ')}`);
          }
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
window.AssetParsers = AssetParsers;
