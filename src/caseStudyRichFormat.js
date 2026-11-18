import { getSchema } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { Table, TableKit } from '@tiptap/extension-table';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle, FontFamily, FontSize } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import {CaseStudyObject,validCaseStudyObject} from './caseStudyV8Objects.js';

function imageAttribute(name, fallback) {
  const htmlName='data-'+name.replace(/[A-Z]/g,letter=>'-'+letter.toLowerCase());
  return {
    default:fallback,
    parseHTML:element=>{
      const value=element.getAttribute(htmlName)??element.getAttribute(name.toLowerCase());
      if(value===null)return fallback;
      if(typeof fallback==='boolean')return value==='true';
      if(typeof fallback==='number')return Number.isFinite(Number(value))?Number(value):fallback;
      return value;
    },
    renderHTML:attributes=>({[htmlName]:attributes[name]}),
  };
}

export const RichCaseStudyImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width:imageAttribute('width',100),
      align:imageAttribute('align','center'),
      caption:imageAttribute('caption',''),
      localOnly:imageAttribute('localOnly',false),
      cloudRef:imageAttribute('cloudRef',''),
      rotation:imageAttribute('rotation',0),
      flipX:imageAttribute('flipX',false),
      flipY:imageAttribute('flipY',false),
      wrap:imageAttribute('wrap',false),
    };
  },
});

export const CASE_STUDY_TABLE_STYLES = ['clean', 'header', 'striped', 'outline', 'dark', 'green'];

const StyledTable = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      styleVariant: {
        default: 'clean',
        parseHTML: element => element.getAttribute('data-table-style') || 'clean',
        renderHTML: ({ styleVariant }) => ({
          'data-table-style': CASE_STUDY_TABLE_STYLES.includes(styleVariant) ? styleVariant : 'clean',
        }),
      },
    };
  },
});

export const caseStudyDocumentExtensions = [
  StarterKit.configure({ link: false }),
  CaseStudyObject,
  Link.configure({ openOnClick: false, enableClickSelection: false, protocols: ['http', 'https', 'mailto'] }),
  TableKit.configure({ table: false }),
  StyledTable.configure({ resizable: false }),
  TaskList,
  TaskItem.configure({ nested: true }),
  TextAlign.configure({ types: ['paragraph', 'heading'] }),
  TextStyle,
  FontFamily,
  FontSize,
  Color,
  Highlight.configure({ multicolor: true }),
];


const schema = getSchema([...caseStudyDocumentExtensions, RichCaseStudyImage]);

function assertKnownFields(node, type) {
  for (const name of Object.keys(node.attrs || {})) {
    if (!Object.hasOwn(type.attrs, name)) throw new Error('Unsupported document attributes.');
  }
}

export function validateCaseStudyDocument(document) {
  if (document?.version !== 1 || document.content?.type !== 'doc') return false;
  function validateNode(node) {
    const type = schema.nodes[node.type];
    if (!type) throw new Error('Unsupported document node.');
    assertKnownFields(node, type);
    if (node.type === 'caseStudyObject' && !validCaseStudyObject({...Object.fromEntries(Object.entries(type.attrs).map(([name,value])=>[name,value.default])),...node.attrs})) throw new Error('Invalid object.');
    for (const mark of node.marks || []) {
      if (!schema.marks[mark.type]) throw new Error('Unsupported document mark.');
      assertKnownFields(mark, schema.marks[mark.type]);
    }
    for (const child of node.content || []) validateNode(child);
  }
  try {
    validateNode(document.content);
    schema.nodeFromJSON(document.content).check();
    return true;
  } catch {
    return false;
  }
}

const newNodes = new Set(['taskList', 'taskItem', 'table', 'tableRow', 'tableCell', 'tableHeader', 'caseStudyObject']);
const newMarks = new Set(['highlight', 'textStyle']);

export function usesV8CaseStudyContent(node) {
  if (!node || typeof node !== 'object') return false;
  if (newNodes.has(node.type) || (node.marks || []).some(mark => newMarks.has(mark.type))) return true;
  const { textAlign, rotation, flipX, flipY, wrap } = node.attrs || {};
  if (textAlign || rotation || flipX || flipY || wrap) return true;
  return (node.content || []).some(usesV8CaseStudyContent);
}

export const caseStudyLibraryUsesV8 = library => library?.caseStudyDocumentProtocol === 'v8' || ['studies', 'personalTemplates'].some(field =>
  (library?.[field] || []).some(entry => usesV8CaseStudyContent(entry.richDocument?.content) ||
    Object.values(entry.sectionDocuments || {}).some(document => usesV8CaseStudyContent(document?.content))));

export function isPlainCaseStudyDocument(document) {
  return document?.version === 1 && document.content?.type === 'doc' &&
    Array.isArray(document.content.content) && document.content.content.every(node =>
      node.type === 'paragraph' && !Object.values(node.attrs || {}).some(value => value != null) &&
      (node.content || []).every(child => child.type === 'text' && !child.marks?.length));
}

// Release prerequisite: the compatible-writer trigger is installed before publishing.
// Explicit false builds a compatible reader rollback without enabling new V8 edits.
export const caseStudyV8CloudEnabled = (env = import.meta.env) =>
  env?.PROD === true && env?.VITE_CASE_STUDY_V8_ENABLED !== 'false';

export const caseStudyV8Preview = (localJournal, env = import.meta.env,
  hostname = globalThis.location?.hostname) => caseStudyV8CloudEnabled(env) ||
  (env?.DEV === true && env?.VITE_CASE_STUDY_V8_PREVIEW === 'true' && localJournal === true &&
    ['localhost', '127.0.0.1', '[::1]'].includes(hostname));
