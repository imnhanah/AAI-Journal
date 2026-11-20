import { Node, mergeAttributes } from '@tiptap/core';

const kinds = ['shape', 'chart', 'drawing', 'textBox'];

export const CaseStudyObject = Node.create({
  name:'caseStudyObject',
  group:'block',
  atom:true,
  draggable:true,
  selectable:true,
  addAttributes() {
    const attributes = {
      kind:{ default:'shape' },
      shape:{ default:'arrow' },
      chart:{ default:'bar' },
      values:{ default:[40, 70, 55] },
      text:{ default:'' },
      strokes:{ default:[] },
      width:{ default:60 },
      align:{ default:'center' },
      rotation:{ default:0 },
      flipX:{ default:false },
      flipY:{ default:false },
      wrap:{ default:false },
    };
    return Object.fromEntries(Object.entries(attributes).map(([name,options])=>[name,{
      ...options,
      renderHTML:()=>({}),
      parseHTML:element=>{
        try{return JSON.parse(element.getAttribute('data-case-study-payload')||'{}')[name]??options.default;}
        catch{return options.default;}
      },
    }]));

  },
  parseHTML() {
    return [{ tag:'div[data-case-study-object]', getAttrs:element => {
      try {
        const attributes=JSON.parse(element.getAttribute('data-case-study-payload')||'null');
        return validCaseStudyObject(attributes) ? attributes : false;
      } catch { return false; }
    } }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-case-study-object':kinds.includes(node.attrs.kind) ? node.attrs.kind : 'shape', 'data-case-study-payload':JSON.stringify(node.attrs) }), node.attrs.text || node.attrs.kind];
  },
});

export function validCaseStudyObject(attrs) {
  if (!attrs || typeof attrs !== 'object' || !kinds.includes(attrs.kind)) return false;
  if (!['arrow', 'rect', 'circle', 'line'].includes(attrs.shape || 'arrow')) return false;
  if (!['bar', 'line', 'pie'].includes(attrs.chart || 'bar')) return false;
  if (!Array.isArray(attrs.values) || !attrs.values.length || attrs.values.length > 30 ||
      !attrs.values.every(value => Number.isFinite(value) && value >= 0)) return false;
  if (typeof attrs.text !== 'string' || attrs.text.length > 10000) return false;
  if (!Array.isArray(attrs.strokes) || attrs.strokes.length > 1000) return false;
  return attrs.strokes.every(stroke => /^#[0-9a-f]{6}$/i.test(stroke.color) &&
    Number.isFinite(stroke.width) && stroke.width >= 1 && stroke.width <= 30 &&
    Array.isArray(stroke.points) && stroke.points.length <= 20000 &&
    stroke.points.every(point => Array.isArray(point) && point.length === 2 &&
      point.every(value => Number.isFinite(value) && value >= 0 && value <= 1000)));
}
