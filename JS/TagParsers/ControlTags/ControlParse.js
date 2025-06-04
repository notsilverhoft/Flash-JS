// ControlParser.js
// Contains parsers for all Control tags in SWF

// End (0) Tag Parser
// Tag indicates the end of the SWF file
// Tag has no content (zero-length)
function parseEndTag(tagData, offset, tagLength) {
    // No data to parse for End tag (length is always 0)
    
    // Create result object
    const result = {
        type: "End",
        description: "End of SWF file" 
    };
    
    // Log to terminal
    console.log("[ControlParser] Parsed End tag");
    
    return result;
}

// ShowFrame (1) Tag Parser
// Tag advances to the next frame
// Tag has no content (zero-length)
function parseShowFrameTag(tagData, offset, tagLength) {
    // No data to parse for ShowFrame tag (length is always 0)
    
    // Create result object
    const result = {
        type: "ShowFrame",
        description: "Advance to next frame" 
    };
    
    // Log to terminal
    console.log("[ControlParser] Parsed ShowFrame tag");
    
    return result;
}

// FrameLabel (43) Tag Parser
// Tag assigns a name to a frame
// Tag contains a null-terminated string (frame name)
function parseFrameLabelTag(tagData, offset, tagLength) {
    let name = "";
    let i = 0;
    
    // Read null-terminated string
    while (offset + i < tagData.length && tagData[offset + i] !== 0) {
        name += String.fromCharCode(tagData[offset + i]);
        i++;
    }
    
    // Create result object
    const result = {
        type: "FrameLabel",
        name: name,
        description: `Label for frame: "${name}"` 
    };
    
    // Log to terminal
    console.log(`[ControlParser] Parsed FrameLabel tag: "${name}"`);
    
    return result;
}

// Protect (24) Tag Parser
// Tag indicates SWF is protected
// Tag may contain MD5 password hash (optional)
function parseProtectTag(tagData, offset, tagLength) {
    const hasPassword = tagLength > 0;
    
    // Create result object
    const result = {
        type: "Protect",
        hasPassword: hasPassword,
        description: hasPassword ? "SWF protected with password" : "SWF protected" 
    };
    
    // Log to terminal
    console.log(`[ControlParser] Parsed Protect tag: ${hasPassword ? "with password" : "no password"}`);
    
    return result;
}

// SetTabIndex (66) Tag Parser
// Tag sets tab order of objects
// Tag contains depth (UINT16) and tab index (UINT16)
function parseSetTabIndexTag(tagData, offset, tagLength) {
    const depth = tagData[offset] | (tagData[offset + 1] << 8);
    const tabIndex = tagData[offset + 2] | (tagData[offset + 3] << 8);
    
    // Create result object
    const result = {
        type: "SetTabIndex",
        depth: depth,
        tabIndex: tabIndex,
        description: `Set tab index ${tabIndex} for depth ${depth}` 
    };
    
    // Log to terminal
    console.log(`[ControlParser] Parsed SetTabIndex tag: depth=${depth}, tabIndex=${tabIndex}`);
    
    return result;
}

// SymbolClass (76) Tag Parser
// Tag maps symbols to AS3 classes
// Tag contains count (UINT16) and array of tag ID+string pairs
function parseSymbolClassTag(tagData, offset, tagLength) {
    const count = tagData[offset] | (tagData[offset + 1] << 8);
    const symbols = [];
    let currentOffset = offset + 2;
    
    // Parse each symbol entry
    for (let i = 0; i < count; i++) {
        const tagId = tagData[currentOffset] | (tagData[currentOffset + 1] << 8);
        currentOffset += 2;
        
        let name = "";
        while (currentOffset < tagData.length && tagData[currentOffset] !== 0) {
            name += String.fromCharCode(tagData[currentOffset]);
            currentOffset++;
        }
        currentOffset++; // Skip null terminator
        
        symbols.push({ id: tagId, name: name });
    }
    
    // Create result object
    const result = {
        type: "SymbolClass",
        symbols: symbols,
        description: `Symbol class mappings (${count} symbols)` 
    };
    
    // Log to terminal
    console.log(`[ControlParser] Parsed SymbolClass tag: ${count} symbols defined`);
    
    return result;
}

// Main control tag parser function
// Routes to the appropriate parser based on tag type
function parseControlTag(tagData, offset, tagType, tagLength) {
    switch (tagType) {
        case 0: // End
            return parseEndTag(tagData, offset, tagLength);
        case 1: // ShowFrame
            return parseShowFrameTag(tagData, offset, tagLength);
        case 43: // FrameLabel
            return parseFrameLabelTag(tagData, offset, tagLength);
        case 24: // Protect
            return parseProtectTag(tagData, offset, tagLength);
        case 66: // SetTabIndex
            return parseSetTabIndexTag(tagData, offset, tagLength);
        case 76: // SymbolClass
            return parseSymbolClassTag(tagData, offset, tagLength);
        default:
            console.log(`[ControlParser] Unknown control tag type: ${tagType}`);
            return {
                type: "UnknownControl",
                tagType: tagType,
                description: `Unknown control tag type: ${tagType}`
            };
    }
}

// Export the main function
export { parseControlTag };
