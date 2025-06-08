/* 
 * SWF ActionScript 3.0 (ABC) Parser - v1.0
 * Handles ActionScript 3.0 bytecode parsing and analysis
 * DoABC (Tag 82) comprehensive parsing with class structure analysis
 */
class AS3Parsers {
  constructor() {
    this.dataTypes = new SWFDataTypes();
  }
  
  // ==================== MAIN ACTIONSCRIPT 3.0 PARSER ====================
  
  parseDoABC(reader, length) {
    try {
      const flags = this.dataTypes.parseUI32(reader);
      const name = this.dataTypes.parseString(reader);
      const headerSize = 4 + name.length + 1;
      const abcDataLength = length - headerSize;
      
      if (abcDataLength <= 0) {
        return {
          tagType: "DoABC",
          description: "Defines ActionScript 3.0 bytecode (ABC format)",
          data: {
            flags: flags,
            flagsFormatted: this.formatDoABCFlags(flags),
            name: name,
            abcDataLength: 0,
            version: "3.0",
            error: "No ABC data present"
          }
        };
      }
      
      // Parse ABC file structure
      const abcFile = this.parseABCFile(reader, abcDataLength);
      
      return {
        tagType: "DoABC",
        description: "Defines ActionScript 3.0 bytecode (ABC format)",
        data: {
          flags: flags,
          flagsFormatted: this.formatDoABCFlags(flags),
          name: name,
          abcDataLength: abcDataLength,
          version: "3.0",
          lazyInitializeFlag: (flags & 0x01) !== 0,
          abcFile: abcFile,
          classAnalysis: this.analyzeAS3Classes(abcFile),
          complexityAnalysis: this.analyzeAS3Complexity(abcFile),
          performanceInsights: this.analyzeAS3Performance(abcFile)
        }
      };
      
    } catch (error) {
      return {
        tagType: "DoABC",
        description: "Defines ActionScript 3.0 bytecode (ABC format)",
        error: `ABC parse error: ${error.message}`,
        data: {
          version: "3.0"
        }
      };
    }
  }
  
  // ==================== ABC FILE STRUCTURE PARSING ====================
  
  parseABCFile(reader, abcDataLength) {
    try {
      const startPosition = reader.byteOffset;
      
      // ABC file header
      const minorVersion = this.dataTypes.parseUI16(reader);
      const majorVersion = this.dataTypes.parseUI16(reader);
      
      if (majorVersion !== 46 || minorVersion !== 16) {
        return {
          parseError: `Unsupported ABC version: ${majorVersion}.${minorVersion}`,
          minorVersion: minorVersion,
          majorVersion: majorVersion,
          expectedVersion: "46.16"
        };
      }
      
      // Parse constant pool
      const constantPool = this.parseABCConstantPool(reader);
      
      // Parse method signatures
      const methodCount = this.parseU30(reader);
      const methods = [];
      
      for (let i = 0; i < Math.min(methodCount, 100); i++) {
        const method = this.parseABCMethodInfo(reader, constantPool);
        methods.push(method);
      }
      
      // Parse metadata
      const metadataCount = this.parseU30(reader);
      const metadata = [];
      
      for (let i = 0; i < Math.min(metadataCount, 20); i++) {
        const meta = this.parseABCMetadataInfo(reader, constantPool);
        metadata.push(meta);
      }
      
      // Parse class info
      const classCount = this.parseU30(reader);
      const classes = [];
      
      for (let i = 0; i < Math.min(classCount, 50); i++) {
        const classInfo = this.parseABCClassInfo(reader, constantPool);
        classes.push(classInfo);
      }
      
      // Parse script info
      const scriptCount = this.parseU30(reader);
      const scripts = [];
      
      for (let i = 0; i < Math.min(scriptCount, 20); i++) {
        const script = this.parseABCScriptInfo(reader, constantPool);
        scripts.push(script);
      }
      
      // Calculate parsing progress
      const bytesConsumed = reader.byteOffset - startPosition;
      const bytesRemaining = abcDataLength - bytesConsumed;
      
      return {
        minorVersion: minorVersion,
        majorVersion: majorVersion,
        versionString: `${majorVersion}.${minorVersion}`,
        constantPool: constantPool,
        methodCount: methodCount,
        methods: methods,
        methodsTruncated: methodCount > 100,
        metadataCount: metadataCount,
        metadata: metadata,
        metadataTruncated: metadataCount > 20,
        classCount: classCount,
        classes: classes,
        classesTruncated: classCount > 50,
        scriptCount: scriptCount,
        scripts: scripts,
        scriptsTruncated: scriptCount > 20,
        bytesConsumed: bytesConsumed,
        bytesRemaining: bytesRemaining,
        parsingProgress: Math.min(100, Math.round((bytesConsumed / abcDataLength) * 100))
      };
      
    } catch (error) {
      return {
        parseError: `ABC file parsing failed: ${error.message}`,
        note: "ABC format is complex - this parser provides core structure analysis"
      };
    }
  }
  
  // ==================== CONSTANT POOL PARSING ====================
  
  parseABCConstantPool(reader) {
    try {
      // Integer constant pool
      const intCount = this.parseU30(reader) || 1;
      const integers = [0]; // Index 0 is always 0
      
      for (let i = 1; i < Math.min(intCount, 200); i++) {
        integers.push(this.parseS32(reader));
      }
      
      // Unsigned integer constant pool
      const uintCount = this.parseU30(reader) || 1;
      const unsignedIntegers = [0]; // Index 0 is always 0
      
      for (let i = 1; i < Math.min(uintCount, 200); i++) {
        unsignedIntegers.push(this.parseU32(reader));
      }
      
      // Double constant pool
      const doubleCount = this.parseU30(reader) || 1;
      const doubles = [NaN]; // Index 0 is always NaN
      
      for (let i = 1; i < Math.min(doubleCount, 200); i++) {
        doubles.push(this.dataTypes.parseDOUBLE(reader));
      }
      
      // String constant pool
      const stringCount = this.parseU30(reader) || 1;
      const strings = [""]; // Index 0 is always empty string
      
      for (let i = 1; i < Math.min(stringCount, 500); i++) {
        const stringLength = this.parseU30(reader);
        let string = "";
        for (let j = 0; j < Math.min(stringLength, 500); j++) {
          string += String.fromCharCode(this.dataTypes.parseUI8(reader));
        }
        strings.push(string);
      }
      
      // Namespace constant pool
      const namespaceCount = this.parseU30(reader) || 1;
      const namespaces = [null]; // Index 0 is always null
      
      for (let i = 1; i < Math.min(namespaceCount, 100); i++) {
        const kind = this.dataTypes.parseUI8(reader);
        const name = this.parseU30(reader);
        namespaces.push({
          kind: kind,
          kindName: this.getNamespaceKindName(kind),
          name: name,
          nameString: name < strings.length ? strings[name] : `string_${name}`
        });
      }
      
      // Namespace set constant pool
      const namespaceSetCount = this.parseU30(reader) || 1;
      const namespaceSets = [null]; // Index 0 is always null
      
      for (let i = 1; i < Math.min(namespaceSetCount, 50); i++) {
        const nsCount = this.parseU30(reader);
        const nsSet = [];
        for (let j = 0; j < Math.min(nsCount, 20); j++) {
          nsSet.push(this.parseU30(reader));
        }
        namespaceSets.push(nsSet);
      }
      
      // Multiname constant pool
      const multinameCount = this.parseU30(reader) || 1;
      const multinames = [null]; // Index 0 is always null
      
      for (let i = 1; i < Math.min(multinameCount, 200); i++) {
        const multiname = this.parseABCMultiname(reader, strings, namespaces);
        multinames.push(multiname);
      }
      
      return {
        integers: integers,
        intCount: intCount,
        intTruncated: intCount > 200,
        unsignedIntegers: unsignedIntegers,
        uintCount: uintCount,
        uintTruncated: uintCount > 200,
        doubles: doubles,
        doubleCount: doubleCount,
        doubleTruncated: doubleCount > 200,
        strings: strings,
        stringCount: stringCount,
        stringTruncated: stringCount > 500,
        namespaces: namespaces,
        namespaceCount: namespaceCount,
        namespaceTruncated: namespaceCount > 100,
        namespaceSets: namespaceSets,
        namespaceSetCount: namespaceSetCount,
        namespaceSetTruncated: namespaceSetCount > 50,
        multinames: multinames,
        multinameCount: multinameCount,
        multinameTruncated: multinameCount > 200
      };
      
    } catch (error) {
      return {
        parseError: `Constant pool parsing failed: ${error.message}`
      };
    }
  }
  
  parseABCMultiname(reader, strings, namespaces) {
    try {
      const kind = this.dataTypes.parseUI8(reader);
      const multiname = {
        kind: kind,
        kindName: this.getMultinameKindName(kind)
      };
      
      switch (kind) {
        case 0x07: // QName
        case 0x0D: // QNameA
          multiname.namespace = this.parseU30(reader);
          multiname.name = this.parseU30(reader);
          multiname.nameString = multiname.name < strings.length ? strings[multiname.name] : `string_${multiname.name}`;
          multiname.formatted = multiname.nameString;
          break;
          
        case 0x0F: // RTQName
        case 0x10: // RTQNameA
          multiname.name = this.parseU30(reader);
          multiname.nameString = multiname.name < strings.length ? strings[multiname.name] : `string_${multiname.name}`;
          multiname.formatted = `*:${multiname.nameString}`;
          break;
          
        case 0x11: // RTQNameL
        case 0x12: // RTQNameLA
          multiname.formatted = "*:*";
          break;
          
        case 0x09: // Multiname
        case 0x0E: // MultinameA
          multiname.name = this.parseU30(reader);
          multiname.namespaceSet = this.parseU30(reader);
          multiname.nameString = multiname.name < strings.length ? strings[multiname.name] : `string_${multiname.name}`;
          multiname.formatted = `{*}:${multiname.nameString}`;
          break;
          
        case 0x1B: // MultinameL
        case 0x1C: // MultinameLA
          multiname.namespaceSet = this.parseU30(reader);
          multiname.formatted = "{*}:*";
          break;
          
        default:
          multiname.formatted = `Unknown(${kind})`;
          break;
      }
      
      return multiname;
      
    } catch (error) {
      return {
        parseError: `Multiname parsing failed: ${error.message}`,
        kind: 0,
        kindName: "Unknown"
      };
    }
  }
  
  // ==================== METHOD INFO PARSING ====================
  
  parseABCMethodInfo(reader, constantPool) {
    try {
      const paramCount = this.parseU30(reader);
      const returnType = this.parseU30(reader);
      
      const params = [];
      for (let i = 0; i < Math.min(paramCount, 50); i++) {
        params.push(this.parseU30(reader));
      }
      
      const name = this.parseU30(reader);
      const flags = this.dataTypes.parseUI8(reader);
      
      // Parse optional parameters if present
      let optionalParams = null;
      if (flags & 0x08) { // HAS_OPTIONAL
        const optionalCount = this.parseU30(reader);
        optionalParams = [];
        for (let i = 0; i < Math.min(optionalCount, 20); i++) {
          const value = this.parseU30(reader);
          const kind = this.dataTypes.parseUI8(reader);
          optionalParams.push({ value, kind, kindName: this.getDefaultValueKindName(kind) });
        }
      }
      
      // Parse parameter names if present
      let paramNames = null;
      if (flags & 0x80) { // HAS_PARAM_NAMES
        paramNames = [];
        for (let i = 0; i < Math.min(paramCount, 50); i++) {
          paramNames.push(this.parseU30(reader));
        }
      }
      
      return {
        paramCount: paramCount,
        returnType: returnType,
        returnTypeName: this.getMultinameString(returnType, constantPool),
        params: params,
        paramTypes: params.map(p => this.getMultinameString(p, constantPool)),
        paramNames: paramNames,
        paramNamesStrings: paramNames ? paramNames.map(n => this.getStringFromPool(n, constantPool)) : null,
        name: name,
        nameString: this.getStringFromPool(name, constantPool),
        flags: flags,
        flagsFormatted: this.formatMethodFlags(flags),
        optionalParams: optionalParams,
        signature: this.formatMethodSignature(name, params, returnType, constantPool),
        isNative: !!(flags & 0x20),
        hasRest: !!(flags & 0x04),
        hasOptional: !!(flags & 0x08),
        hasParamNames: !!(flags & 0x80)
      };
      
    } catch (error) {
      return {
        parseError: `Method info parsing failed: ${error.message}`
      };
    }
  }
  
  // ==================== METADATA INFO PARSING ====================
  
  parseABCMetadataInfo(reader, constantPool) {
    try {
      const name = this.parseU30(reader);
      const itemCount = this.parseU30(reader);
      
      const items = [];
      for (let i = 0; i < Math.min(itemCount, 20); i++) {
        const key = this.parseU30(reader);
        const value = this.parseU30(reader);
        items.push({
          key: key,
          keyString: this.getStringFromPool(key, constantPool),
          value: value,
          valueString: this.getStringFromPool(value, constantPool)
        });
      }
      
      return {
        name: name,
        nameString: this.getStringFromPool(name, constantPool),
        itemCount: itemCount,
        items: items,
        itemsTruncated: itemCount > 20
      };
      
    } catch (error) {
      return {
        parseError: `Metadata parsing failed: ${error.message}`
      };
    }
  }
  
  // ==================== CLASS INFO PARSING ====================
  
  parseABCClassInfo(reader, constantPool) {
    try {
      const name = this.parseU30(reader);
      const superName = this.parseU30(reader);
      const flags = this.dataTypes.parseUI8(reader);
      
      let protectedNs = null;
      if (flags & 0x08) { // CONSTANT_ClassProtectedNs
        protectedNs = this.parseU30(reader);
      }
      
      const interfaceCount = this.parseU30(reader);
      const interfaces = [];
      for (let i = 0; i < Math.min(interfaceCount, 20); i++) {
        interfaces.push(this.parseU30(reader));
      }
      
      const iinit = this.parseU30(reader);
      
      // Parse traits
      const traitCount = this.parseU30(reader);
      const traits = [];
      
      for (let i = 0; i < Math.min(traitCount, 50); i++) {
        const trait = this.parseABCTrait(reader, constantPool);
        traits.push(trait);
      }
      
      return {
        name: name,
        nameString: this.getMultinameString(name, constantPool),
        superName: superName,
        superNameString: this.getMultinameString(superName, constantPool),
        flags: flags,
        flagsFormatted: this.formatClassFlags(flags),
        protectedNs: protectedNs,
        interfaceCount: interfaceCount,
        interfaces: interfaces,
        interfaceStrings: interfaces.map(i => this.getMultinameString(i, constantPool)),
        interfacesTruncated: interfaceCount > 20,
        iinit: iinit,
        traitCount: traitCount,
        traits: traits,
        traitsTruncated: traitCount > 50,
        isSealed: !!(flags & 0x01),
        isFinal: !!(flags & 0x02),
        isInterface: !!(flags & 0x04),
        hasProtectedNs: !!(flags & 0x08),
        classSignature: this.formatClassSignature(name, superName, interfaces, constantPool)
      };
      
    } catch (error) {
      return {
        parseError: `Class info parsing failed: ${error.message}`
      };
    }
  }
  
  parseABCScriptInfo(reader, constantPool) {
    try {
      const init = this.parseU30(reader);
      const traitCount = this.parseU30(reader);
      
      const traits = [];
      for (let i = 0; i < Math.min(traitCount, 30); i++) {
        const trait = this.parseABCTrait(reader, constantPool);
        traits.push(trait);
      }
      
      return {
        init: init,
        traitCount: traitCount,
        traits: traits,
        traitsTruncated: traitCount > 30
      };
      
    } catch (error) {
      return {
        parseError: `Script info parsing failed: ${error.message}`
      };
    }
  }
  
  parseABCTrait(reader, constantPool) {
    try {
      const name = this.parseU30(reader);
      const kind = this.dataTypes.parseUI8(reader);
      
      const traitKind = kind & 0x0F;
      const traitAttributes = (kind >> 4) & 0x0F;
      
      const trait = {
        name: name,
        nameString: this.getMultinameString(name, constantPool),
        kind: traitKind,
        kindName: this.getTraitKindName(traitKind),
        attributes: traitAttributes,
        isFinal: !!(traitAttributes & 0x01),
        isOverride: !!(traitAttributes & 0x02),
        hasMetadata: !!(traitAttributes & 0x04)
      };
      
      // Parse trait data based on kind
      switch (traitKind) {
        case 0: // Slot
        case 6: // Const
          trait.slotId = this.parseU30(reader);
          trait.typeName = this.parseU30(reader);
          trait.typeNameString = this.getMultinameString(trait.typeName, constantPool);
          trait.vindex = this.parseU30(reader);
          if (trait.vindex !== 0) {
            trait.vkind = this.dataTypes.parseUI8(reader);
            trait.vkindName = this.getDefaultValueKindName(trait.vkind);
          }
          trait.signature = `${trait.kindName} ${trait.nameString}:${trait.typeNameString}`;
          break;
          
        case 1: // Method
        case 2: // Getter
        case 3: // Setter
          trait.dispId = this.parseU30(reader);
          trait.method = this.parseU30(reader);
          trait.signature = `${trait.kindName} ${trait.nameString}()`;
          break;
          
        case 4: // Class
          trait.slotId = this.parseU30(reader);
          trait.classi = this.parseU30(reader);
          trait.signature = `Class ${trait.nameString}`;
          break;
          
        case 5: // Function
          trait.slotId = this.parseU30(reader);
          trait.function = this.parseU30(reader);
          trait.signature = `Function ${trait.nameString}()`;
          break;
          
        default:
          trait.signature = `Unknown ${trait.nameString}`;
          break;
      }
      
      // Skip metadata if present
      if (trait.hasMetadata) {
        const metadataCount = this.parseU30(reader);
        trait.metadataCount = metadataCount;
        for (let i = 0; i < metadataCount; i++) {
          this.parseU30(reader); // Skip metadata indices
        }
      }
      
      return trait;
      
    } catch (error) {
      return {
        parseError: `Trait parsing failed: ${error.message}`
      };
    }
  }
  
  // ==================== UTILITY METHODS ====================
  
  parseU30(reader) {
    let result = 0;
    let shift = 0;
    
    for (let i = 0; i < 5; i++) {
      const byte = this.dataTypes.parseUI8(reader);
      result |= (byte & 0x7F) << shift;
      
      if ((byte & 0x80) === 0) {
        break;
      }
      
      shift += 7;
    }
    
    return result;
  }
  
  parseS32(reader) {
    const value = this.parseU30(reader);
    return value < 0x80000000 ? value : value - 0x100000000;
  }
  
  parseU32(reader) {
    return this.parseU30(reader);
  }
  
  getStringFromPool(index, constantPool) {
    if (!constantPool || !constantPool.strings || index >= constantPool.strings.length) {
      return `string_${index}`;
    }
    return constantPool.strings[index] || `string_${index}`;
  }
  
  getMultinameString(index, constantPool) {
    if (!constantPool || !constantPool.multinames || index >= constantPool.multinames.length) {
      return `multiname_${index}`;
    }
    
    const multiname = constantPool.multinames[index];
    if (!multiname) return `multiname_${index}`;
    
    return multiname.formatted || multiname.nameString || `multiname_${index}`;
  }
  
  // ==================== NAME/KIND FORMATTERS ====================
  
  getNamespaceKindName(kind) {
    const kinds = {
      0x08: "Namespace",
      0x16: "PackageNamespace",
      0x17: "PackageInternalNs",
      0x18: "ProtectedNamespace",
      0x19: "ExplicitNamespace",
      0x1A: "StaticProtectedNs",
      0x05: "PrivateNamespace"
    };
    return kinds[kind] || `Unknown(${kind})`;
  }
  
  getMultinameKindName(kind) {
    const kinds = {
      0x07: "QName",
      0x0D: "QNameA",
      0x0F: "RTQName",
      0x10: "RTQNameA",
      0x11: "RTQNameL",
      0x12: "RTQNameLA",
      0x09: "Multiname",
      0x0E: "MultinameA",
      0x1B: "MultinameL",
      0x1C: "MultinameLA"
    };
    return kinds[kind] || `Unknown(${kind})`;
  }
  
  getTraitKindName(kind) {
    const kinds = {
      0: "Slot",
      1: "Method",
      2: "Getter",
      3: "Setter",
      4: "Class",
      5: "Function",
      6: "Const"
    };
    return kinds[kind] || `Unknown(${kind})`;
  }
  
  getDefaultValueKindName(kind) {
    const kinds = {
      0x00: "Undefined",
      0x01: "String",
      0x03: "Integer",
      0x04: "UInteger",
      0x06: "Double",
      0x08: "Namespace",
      0x0A: "False",
      0x0B: "True",
      0x0C: "Null"
    };
    return kinds[kind] || `Unknown(${kind})`;
  }
  
  // ==================== FLAG FORMATTERS ====================
  
  formatDoABCFlags(flags) {
    const flagNames = [];
    if (flags & 0x01) flagNames.push("LazyInitializeFlag");
    return flagNames.length > 0 ? flagNames.join(", ") : "None";
  }
  
  formatMethodFlags(flags) {
    const flagNames = [];
    if (flags & 0x01) flagNames.push("NEED_ARGUMENTS");
    if (flags & 0x02) flagNames.push("NEED_ACTIVATION");
    if (flags & 0x04) flagNames.push("NEED_REST");
    if (flags & 0x08) flagNames.push("HAS_OPTIONAL");
    if (flags & 0x10) flagNames.push("SET_DXNS");
    if (flags & 0x20) flagNames.push("HAS_PARAM_NAMES");
    return flagNames.length > 0 ? flagNames.join(", ") : "None";
  }
  
  formatClassFlags(flags) {
    const flagNames = [];
    if (flags & 0x01) flagNames.push("SEALED");
    if (flags & 0x02) flagNames.push("FINAL");
    if (flags & 0x04) flagNames.push("INTERFACE");
    if (flags & 0x08) flagNames.push("PROTECTED");
    return flagNames.length > 0 ? flagNames.join(", ") : "None";
  }
  
  formatMethodSignature(nameIndex, params, returnType, constantPool) {
    const name = this.getStringFromPool(nameIndex, constantPool);
    const paramTypes = params.map(p => this.getMultinameString(p, constantPool));
    const returnTypeName = this.getMultinameString(returnType, constantPool);
    
    return `function ${name}(${paramTypes.join(', ')}):${returnTypeName}`;
  }
  
  formatClassSignature(nameIndex, superIndex, interfaces, constantPool) {
    const name = this.getMultinameString(nameIndex, constantPool);
    const superName = this.getMultinameString(superIndex, constantPool);
    
    let signature = `class ${name}`;
    if (superName && superName !== "Object") {
      signature += ` extends ${superName}`;
    }
    if (interfaces.length > 0) {
      const interfaceNames = interfaces.map(i => this.getMultinameString(i, constantPool));
      signature += ` implements ${interfaceNames.join(', ')}`;
    }
    
    return signature;
  }
  
  // ==================== ANALYSIS METHODS ====================
  
  analyzeAS3Classes(abcFile) {
    if (!abcFile || !abcFile.classes) {
      return {
        totalClasses: 0,
        note: "No class data available"
      };
    }
    
    const analysis = {
      totalClasses: abcFile.classCount,
      classesParsed: abcFile.classes.length,
      classTypes: {},
      inheritance: {},
      features: [],
      packageStructure: {},
      complexityDistribution: {}
    };
    
    abcFile.classes.forEach(classInfo => {
      if (classInfo.nameString) {
        // Analyze class types
        const name = classInfo.nameString.toLowerCase();
        if (name.includes('sprite') || name.includes('movieclip')) {
          analysis.classTypes.displays = (analysis.classTypes.displays || 0) + 1;
        } else if (name.includes('button')) {
          analysis.classTypes.ui = (analysis.classTypes.ui || 0) + 1;
        } else if (name.includes('event')) {
          analysis.classTypes.events = (analysis.classTypes.events || 0) + 1;
        } else if (name.includes('loader') || name.includes('sound')) {
          analysis.classTypes.media = (analysis.classTypes.media || 0) + 1;
        } else {
          analysis.classTypes.application = (analysis.classTypes.application || 0) + 1;
        }
        
        // Analyze package structure
        const className = classInfo.nameString;
        if (className.includes('.')) {
          const packageName = className.substring(0, className.lastIndexOf('.'));
          analysis.packageStructure[packageName] = (analysis.packageStructure[packageName] || 0) + 1;
        }
      }
      
      // Analyze inheritance
      if (classInfo.superNameString && classInfo.superNameString !== "Object" && classInfo.superNameString !== "multiname_0") {
        analysis.inheritance[classInfo.superNameString] = (analysis.inheritance[classInfo.superNameString] || 0) + 1;
      }
      
      // Analyze complexity
      const traitCount = classInfo.traitCount || 0;
      if (traitCount > 20) {
        analysis.complexityDistribution.complex = (analysis.complexityDistribution.complex || 0) + 1;
      } else if (traitCount > 5) {
        analysis.complexityDistribution.moderate = (analysis.complexityDistribution.moderate || 0) + 1;
      } else {
        analysis.complexityDistribution.simple = (analysis.complexityDistribution.simple || 0) + 1;
      }
      
      // Analyze features
      if (classInfo.isInterface) {
        analysis.features.push("Uses interfaces");
      }
      if (classInfo.isFinal) {
        analysis.features.push("Uses final classes");
      }
      if (classInfo.isSealed) {
        analysis.features.push("Uses sealed classes");
      }
      if (classInfo.interfaceCount > 0) {
        analysis.features.push("Implements interfaces");
      }
    });
    
    // Remove duplicates from features
    analysis.features = [...new Set(analysis.features)];
    
    // Determine architecture pattern
    const totalClasses = analysis.classesParsed;
    if (totalClasses > 50) {
      analysis.architecturePattern = "Large application";
    } else if (totalClasses > 20) {
      analysis.architecturePattern = "Medium application";
    } else if (totalClasses > 5) {
      analysis.architecturePattern = "Small application";
    } else {
      analysis.architecturePattern = "Simple script";
    }
    
    return analysis;
  }
  
  analyzeAS3Complexity(abcFile) {
    if (!abcFile) {
      return { level: "unknown", note: "No ABC data available" };
    }
    
    let complexityScore = 0;
    const factors = [];
    
    // Constant pool complexity
    if (abcFile.constantPool) {
      const cp = abcFile.constantPool;
      
      if (cp.stringCount > 1000) {
        complexityScore += 4;
        factors.push("Very large string pool (1000+ strings)");
      } else if (cp.stringCount > 500) {
        complexityScore += 3;
        factors.push("Large string pool (500+ strings)");
      } else if (cp.stringCount > 100) {
        complexityScore += 2;
        factors.push("Moderate string pool (100+ strings)");
      }
      
      if (cp.multinameCount > 500) {
        complexityScore += 4;
        factors.push("Very complex multiname pool (500+ multinames)");
      } else if (cp.multinameCount > 200) {
        complexityScore += 3;
        factors.push("Complex multiname pool (200+ multinames)");
      } else if (cp.multinameCount > 50) {
        complexityScore += 2;
        factors.push("Moderate multiname pool (50+ multinames)");
      }
      
      if (cp.doubleCount > 100) {
        complexityScore += 2;
        factors.push("Many floating point constants");
      }
    }
    
    // Method complexity
    if (abcFile.methodCount > 500) {
      complexityScore += 4;
      factors.push("Very many methods (500+)");
    } else if (abcFile.methodCount > 200) {
      complexityScore += 3;
      factors.push("Many methods (200+)");
    } else if (abcFile.methodCount > 50) {
      complexityScore += 2;
      factors.push("Moderate method count (50+)");
    }
    
    // Class complexity
    if (abcFile.classCount > 100) {
      complexityScore += 4;
      factors.push("Very many classes (100+)");
    } else if (abcFile.classCount > 50) {
      complexityScore += 3;
      factors.push("Many classes (50+)");
    } else if (abcFile.classCount > 20) {
      complexityScore += 2;
      factors.push("Moderate class count (20+)");
    }
    
    // Script complexity
    if (abcFile.scriptCount > 20) {
      complexityScore += 2;
      factors.push("Multiple script blocks");
    }
    
    let level;
    if (complexityScore >= 12) {
      level = "very_complex";
    } else if (complexityScore >= 8) {
      level = "complex";
    } else if (complexityScore >= 4) {
      level = "moderate";
    } else {
      level = "simple";
    }
    
    return {
      level: level,
      score: complexityScore,
      factors: factors
    };
  }
  
  analyzeAS3Performance(abcFile) {
    if (!abcFile) {
      return { impact: "unknown", note: "No ABC data available" };
    }
    
    const factors = [];
    let impactScore = 0;
    
    // Large constant pools increase memory usage
    if (abcFile.constantPool) {
      if (abcFile.constantPool.stringCount > 1000) {
        impactScore += 3;
        factors.push("Very large string pool increases memory usage");
      }
      if (abcFile.constantPool.doubleCount > 100) {
        impactScore += 2;
        factors.push("Many double constants increase memory usage");
      }
    }
    
    // Many methods increase compilation time
    if (abcFile.methodCount > 200) {
      impactScore += 3;
      factors.push("Many methods increase compilation time");
    }
    
    // Many classes increase initialization time
    if (abcFile.classCount > 50) {
      impactScore += 2;
      factors.push("Many classes increase initialization time");
    }
    
    let impact;
    if (impactScore >= 6) {
      impact = "high";
    } else if (impactScore >= 3) {
      impact = "moderate";
    } else {
      impact = "low";
    }
    
    const recommendations = [];
    if (impactScore > 3) {
      recommendations.push("Consider code optimization for better performance");
    }
    if (abcFile.constantPool && abcFile.constantPool.stringCount > 500) {
      recommendations.push("Large string pool may benefit from string interning");
    }
    
    return {
      impact: impact,
      score: impactScore,
      factors: factors,
      recommendations: recommendations
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
      
      lines.push(`  └─ Name: "${data.name}"`);
      lines.push(`  └─ ABC Data Length: ${data.abcDataLength} bytes`);
      lines.push(`  └─ Flags: ${data.flagsFormatted}`);
      lines.push(`  └─ Lazy Initialize: ${data.lazyInitializeFlag ? 'Yes' : 'No'}`);
      
      if (data.abcFile) {
        const abc = data.abcFile;
        if (abc.versionString) {
          lines.push(`  └─ ABC Version: ${abc.versionString}`);
        }
        
        if (abc.constantPool) {
          lines.push(`  └─ Strings: ${abc.constantPool.stringCount}${abc.constantPool.stringTruncated ? ' (truncated)' : ''}`);
          lines.push(`  └─ Classes: ${abc.classCount}${abc.classesTruncated ? ' (truncated)' : ''}`);
          lines.push(`  └─ Methods: ${abc.methodCount}${abc.methodsTruncated ? ' (truncated)' : ''}`);
        }
        
        if (abc.parsingProgress) {
          lines.push(`  └─ Parsing Progress: ${abc.parsingProgress}%`);
        }
      }
      
      if (data.classAnalysis) {
        const analysis = data.classAnalysis;
        if (analysis.architecturePattern) {
          lines.push(`  └─ Architecture: ${analysis.architecturePattern}`);
        }
        if (analysis.features.length > 0) {
          lines.push(`  └─ Features: ${analysis.features.slice(0, 2).join(', ')}${analysis.features.length > 2 ? '...' : ''}`);
        }
      }
      
      if (data.complexityAnalysis) {
        lines.push(`  └─ Complexity: ${data.complexityAnalysis.level}`);
      }
      
      if (data.performanceInsights) {
        lines.push(`  └─ Performance Impact: ${data.performanceInsights.impact}`);
        if (data.performanceInsights.recommendations.length > 0) {
          lines.push(`  └─ Recommendation: ${data.performanceInsights.recommendations[0]}`);
        }
      }
    }
    
    return lines.join('\n');
  }
}

// Export for use by other parsers
window.AS3Parsers = AS3Parsers;
