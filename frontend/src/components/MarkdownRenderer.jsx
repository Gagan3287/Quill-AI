import React, { useState, useEffect, useRef } from 'react';
import { Copy, Check } from 'lucide-react';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';

// Import common languages to support syntax highlighting
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';

function CodeBlock({ language, code }) {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef(null);

  useEffect(() => {
    if (codeRef.current) {
      Prism.highlightElement(codeRef.current);
    }
  }, [code, language]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code: ', err);
    }
  };

  const normalizedLang = (language || 'clike').toLowerCase();

  return (
    <div className="my-4 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800 shadow-md">
      {/* Code block header */}
      <div className="flex items-center justify-between bg-gray-800 dark:bg-gray-950 px-4 py-2 text-xs font-mono text-gray-300 select-none">
        <span>{language || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center space-x-1.5 hover:text-white transition-colors py-1 px-2 rounded hover:bg-gray-700 dark:hover:bg-gray-900"
          type="button"
        >
          {copied ? (
            <>
              <Check size={14} className="text-green-400" />
              <span className="text-green-400 font-medium">Copied!</span>
            </>
          ) : (
            <>
              <Copy size={14} />
              <span>Copy code</span>
            </>
          )}
        </button>
      </div>
      {/* Code block body */}
      <div className="bg-[#1d1f21] p-4 overflow-x-auto font-mono text-sm leading-relaxed scrollbar-thin">
        <pre className="!bg-transparent !p-0 !m-0 whitespace-pre"><code ref={codeRef} className={`language-${normalizedLang}`}>{code.trim()}</code></pre>
      </div>
    </div>
  );
}

function parseInlineStyles(text) {
  if (typeof text !== 'string') return text;
  
  // Split inline code blocks first (e.g. `code`)
  const parts = text.split(/(`[^`]+`)/g);
  
  return parts.map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={index}
          className="bg-gray-100 dark:bg-gray-900 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded font-mono text-xs border border-gray-200 dark:border-gray-800"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    
    // Split bold text next (e.g. **bold**)
    const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
    return boldParts.map((bPart, bIndex) => {
      if (bPart.startsWith('**') && bPart.endsWith('**')) {
        return (
          <strong key={`${index}-${bIndex}`} className="font-semibold text-gray-900 dark:text-white">
            {bPart.slice(2, -2)}
          </strong>
        );
      }
      return bPart;
    });
  });
}

function MarkdownText({ text }) {
  if (!text) return null;

  const blocks = [];
  const rawLines = text.split('\n');
  
  let currentBlockType = null; // 'p', 'ul', 'ol'
  let currentItems = [];

  const flushBlock = (key) => {
    if (currentItems.length === 0) return;
    if (currentBlockType === 'ul') {
      blocks.push(
        <ul key={key} className="list-disc pl-6 my-2 space-y-1.5 text-gray-800 dark:text-gray-200">
          {currentItems.map((item, idx) => (
            <li key={idx} className="leading-relaxed">{parseInlineStyles(item)}</li>
          ))}
        </ul>
      );
    } else if (currentBlockType === 'ol') {
      blocks.push(
        <ol key={key} className="list-decimal pl-6 my-2 space-y-1.5 text-gray-800 dark:text-gray-200">
          {currentItems.map((item, idx) => (
            <li key={idx} className="leading-relaxed">{parseInlineStyles(item)}</li>
          ))}
        </ol>
      );
    } else if (currentBlockType === 'p') {
      blocks.push(
        <p key={key} className="my-2.5 leading-relaxed text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
          {parseInlineStyles(currentItems.join('\n'))}
        </p>
      );
    }
    currentItems = [];
    currentBlockType = null;
  };

  let blockKey = 0;
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const trimmedLine = line.trim();

    // Check if heading
    const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
      flushBlock(blockKey++);
      const level = headingMatch[1].length;
      const content = headingMatch[2];
      const headingClasses = [
        "", // 0
        "text-2xl font-bold my-4 text-gray-900 dark:text-white border-b pb-1 border-gray-200 dark:border-gray-800", // h1
        "text-xl font-semibold my-3 text-gray-900 dark:text-white", // h2
        "text-lg font-semibold my-2.5 text-gray-900 dark:text-white", // h3
        "text-base font-medium my-2 text-gray-900 dark:text-white", // h4
        "text-sm font-medium my-1.5 text-gray-900 dark:text-white", // h5
        "text-xs font-medium my-1 text-gray-900 dark:text-white"  // h6
      ][level];
      
      const HeadingTag = `h${level}`;
      blocks.push(
        <HeadingTag key={blockKey++} className={headingClasses}>
          {parseInlineStyles(content)}
        </HeadingTag>
      );
      continue;
    }

    // Check if list item
    const bulletMatch = line.match(/^(\s*)[-*+]\s+(.*)/);
    const numMatch = line.match(/^(\s*)\d+\.\s+(.*)/);

    if (bulletMatch) {
      if (currentBlockType !== 'ul') {
        flushBlock(blockKey++);
        currentBlockType = 'ul';
      }
      currentItems.push(bulletMatch[2]);
    } else if (numMatch) {
      if (currentBlockType !== 'ol') {
        flushBlock(blockKey++);
        currentBlockType = 'ol';
      }
      currentItems.push(numMatch[2]);
    } else if (trimmedLine === '') {
      flushBlock(blockKey++);
    } else {
      if (currentBlockType && currentBlockType !== 'p') {
        flushBlock(blockKey++);
      }
      if (!currentBlockType) {
        currentBlockType = 'p';
      }
      currentItems.push(line);
    }
  }
  flushBlock(blockKey++);

  return <div className="space-y-1">{blocks}</div>;
}

export default function MessageRenderer({ content }) {
  if (!content) return null;

  // Split by code blocks
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-1 text-left">
      {parts.map((part, index) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const firstNewlineIndex = part.indexOf('\n');
          let language = '';
          let code = '';
          if (firstNewlineIndex !== -1) {
            language = part.substring(3, firstNewlineIndex).trim();
            code = part.substring(firstNewlineIndex + 1, part.length - 3);
          } else {
            code = part.slice(3, -3);
          }
          
          return (
            <CodeBlock 
              key={index} 
              language={language} 
              code={code} 
            />
          );
        } else {
          return (
            <MarkdownText 
              key={index} 
              text={part} 
            />
          );
        }
      })}
    </div>
  );
}
