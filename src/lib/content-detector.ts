/**
 * Content Detector for AI Messages
 * Detects artifacts like code blocks, HTML, URLs, and markdown documents
 * to enable Artifact-like UX (similar to Claude)
 */

export interface DetectedArtifact {
  type: 'code' | 'html' | 'markdown-doc' | 'mermaid' | 'url';
  language?: string;
  content: string;
  label: string;
  startIndex: number;
  endIndex: number;
}

// Languages that can be run in sandbox
const EXECUTABLE_LANGUAGES = [
  'javascript', 'js',
  'typescript', 'ts',
  'jsx', 'tsx'
];

// Languages that can be previewed
const PREVIEWABLE_LANGUAGES = [
  'html', 'htm',
  'svg'
];

/**
 * Detect all artifacts in a message
 */
export function detectArtifacts(text: string): DetectedArtifact[] {
  const artifacts: DetectedArtifact[] = [];
  
  // Detect code blocks with language tags
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let match;
  
  while ((match = codeBlockRegex.exec(text)) !== null) {
    const language = match[1]?.toLowerCase() || 'text';
    const content = match[2].trim();
    
    // Skip empty code blocks
    if (!content) continue;
    
    // Determine artifact type based on language
    if (language === 'mermaid') {
      artifacts.push({
        type: 'mermaid',
        language: 'mermaid',
        content,
        label: 'Mermaid Diagram',
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    } else if (PREVIEWABLE_LANGUAGES.includes(language)) {
      artifacts.push({
        type: 'html',
        language,
        content,
        label: language.toUpperCase(),
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    } else if (EXECUTABLE_LANGUAGES.includes(language)) {
      artifacts.push({
        type: 'code',
        language: language === 'js' ? 'javascript' : language === 'ts' ? 'typescript' : language,
        content,
        label: getLanguageLabel(language),
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    } else {
      // Other code blocks (python, json, etc.) - still offer save/copy
      artifacts.push({
        type: 'code',
        language,
        content,
        label: getLanguageLabel(language),
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    }
  }
  
  // Detect standalone URLs (not already in code blocks)
  const urlRegex = /(?<!`)(https?:\/\/[^\s<>\[\]"'`]+)(?!`)/g;
  while ((match = urlRegex.exec(text)) !== null) {
    const url = match[1];
    
    // Check if this URL is inside a code block
    const isInsideCodeBlock = artifacts.some(
      a => match.index >= a.startIndex && match.index < a.endIndex
    );
    
    if (!isInsideCodeBlock) {
      artifacts.push({
        type: 'url',
        content: url,
        label: getDomainFromUrl(url),
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    }
  }
  
  // Detect large markdown documents (multiple headers, structured content)
  // Only if the entire message looks like a document
  if (isMarkdownDocument(text) && !hasOnlyCodeBlocks(text, artifacts)) {
    artifacts.push({
      type: 'markdown-doc',
      content: text,
      label: 'Document',
      startIndex: 0,
      endIndex: text.length,
    });
  }
  
  return artifacts;
}

/**
 * Check if a code block language is executable in sandbox
 */
export function isExecutableLanguage(language: string): boolean {
  return EXECUTABLE_LANGUAGES.includes(language.toLowerCase());
}

/**
 * Check if a code block language is previewable as HTML
 */
export function isPreviewableLanguage(language: string): boolean {
  return PREVIEWABLE_LANGUAGES.includes(language.toLowerCase());
}

/**
 * Get human-readable language label
 */
function getLanguageLabel(language: string): string {
  const labels: Record<string, string> = {
    javascript: 'JavaScript',
    js: 'JavaScript',
    typescript: 'TypeScript',
    ts: 'TypeScript',
    jsx: 'React JSX',
    tsx: 'React TSX',
    html: 'HTML',
    htm: 'HTML',
    css: 'CSS',
    json: 'JSON',
    python: 'Python',
    py: 'Python',
    sql: 'SQL',
    bash: 'Bash',
    sh: 'Shell',
    yaml: 'YAML',
    yml: 'YAML',
    markdown: 'Markdown',
    md: 'Markdown',
    svg: 'SVG',
    xml: 'XML',
  };
  return labels[language.toLowerCase()] || language.toUpperCase();
}

/**
 * Extract domain from URL for display
 */
function getDomainFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    // Remove www. prefix
    return hostname.replace(/^www\./, '');
  } catch {
    return 'Link';
  }
}

/**
 * Check if text appears to be a structured markdown document
 */
function isMarkdownDocument(text: string): boolean {
  // Count headers
  const headerCount = (text.match(/^#{1,6}\s+.+$/gm) || []).length;
  
  // Count list items
  const listCount = (text.match(/^[\s]*[-*+]\s+.+$/gm) || []).length;
  
  // Has multiple paragraphs
  const paragraphCount = text.split(/\n\n+/).filter(p => p.trim()).length;
  
  // Consider it a document if it has multiple headers or structured content
  return headerCount >= 2 || (headerCount >= 1 && (listCount >= 3 || paragraphCount >= 4));
}

/**
 * Check if message only contains code blocks (not a document)
 */
function hasOnlyCodeBlocks(text: string, artifacts: DetectedArtifact[]): boolean {
  const codeArtifacts = artifacts.filter(a => a.type === 'code' || a.type === 'html' || a.type === 'mermaid');
  if (codeArtifacts.length === 0) return false;
  
  // Remove all code blocks and see what's left
  let remaining = text;
  for (const artifact of codeArtifacts) {
    remaining = remaining.replace(text.slice(artifact.startIndex, artifact.endIndex), '');
  }
  
  // If only whitespace and minimal text remains, it's mostly code blocks
  const remainingText = remaining.trim();
  return remainingText.length < 200;
}

/**
 * Get unique artifacts by type (dedupe URLs, etc.)
 */
export function getUniqueArtifacts(artifacts: DetectedArtifact[]): DetectedArtifact[] {
  const seen = new Set<string>();
  return artifacts.filter(a => {
    const key = `${a.type}:${a.content}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
