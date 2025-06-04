// TagContentParser.js - v1.0
// Main coordinator for parsing SWF tag content
// Created by notsilverhoft on 2025-06-04 08:37:46

// Import control tag parser
import { parseControlTag } from './ControlTags/ControlParse.js';

// Main tag content parser function
// Currently only handling Control tags
function parseTagContent(tagData, offset, tagType, tagLength) {
    const terminal = document.getElementById('terminalOutput');
    terminal.textContent += `\n[TagContentParser] Parsing tag type ${tagType} with length ${tagLength}`;
    
    // Control Tags (0, 1, 24, 43, 66, 76)
    if (tagType === 0 || tagType === 1 || tagType === 24 || 
        tagType === 43 || tagType === 66 || tagType === 76) {
        return parseControlTag(tagData, offset, tagType, tagLength);
    }
    
    // Unknown tag type - other tag categories will be implemented later
    terminal.textContent += `\n[TagContentParser] Unknown or unimplemented tag type: ${tagType}`;
    return {
        type: "UnknownTag",
        tagType: tagType,
        description: `Unknown or unimplemented tag type: ${tagType}`
    };
}

// Export the main function
export { parseTagContent };
