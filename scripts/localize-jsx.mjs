// Translate presentation literals at compile time, never stored values or handlers.
// This keeps JSX copy localizable without mutating React's DOM or user journal data.
import { transformAsync } from '@babel/core';
export function localizationPlugin() {
  return {
    name: 'journal-localization', enforce: 'pre',
    async transform(code, id) {
      if (!/\/src\/.*\.jsx(?:\?.*)?$/.test(id) || id.includes('LanguageSelector.jsx')) return null;
      let used = false;
      const result = await transformAsync(code, {
        filename: id, configFile: false, babelrc: false, sourceMaps: true,
        parserOpts: { plugins: ['jsx'] },
        plugins: [({ types: t }) => {
          const call = expression => { used = true; return t.callExpression(t.identifier('__tjTranslate'), [expression]); };
          const userProperties=new Set(['notes','note','context','name','fullName','displayName','email','asset','instrument','pair','text','ruleText','caption']);
          const userIdentifiers=new Set(['children','name','fullName','displayName','email','asset','instrument','pair','notes','note','context','ruleText','text','value','entryType']);
          const display = node => {
            if (t.isStringLiteral(node) && /[a-zA-Z]/.test(node.value)) return call(node);
            if(t.isTemplateLiteral(node)&&node.quasis.some(part=>/[a-zA-Z]{2}/.test(part.value.cooked))){
              used=true;
              const source=node.quasis.map((part,index)=>part.value.cooked+(index<node.expressions.length?`{${index}}`:'')).join('');
              return t.callExpression(t.identifier('__tjTemplate'),[t.stringLiteral(source),t.arrayExpression(node.expressions.map(display))]);
            }
            if (t.isConditionalExpression(node)) {node.consequent = display(node.consequent); node.alternate = display(node.alternate);return node;}
            if (t.isLogicalExpression(node)) {node.left=display(node.left);node.right=display(node.right);return node;}
            if(t.isIdentifier(node)&&!userIdentifiers.has(node.name))return call(node);
            if((t.isMemberExpression(node)||t.isOptionalMemberExpression(node))&&!userProperties.has(node.property.name))return call(node);
            if(t.isCallExpression(node)&&!['__tjTranslate','translate','__tjTemplate','translateTemplate','__tjDateLocale','tradeNote'].includes(node.callee.name))return call(node);
            return node;
          };
          return {visitor:{
            JSXText(path) {
              const lines = path.node.value.split(/\r\n|\n|\r/);
              let text = '';
              lines.forEach((line, index) => {let part = line.replace(/\t/g, ' '); if(index)part=part.replace(/^ +/,''); if(index<lines.length-1)part=part.replace(/ +$/,''); if(part){text+=part;if(index<lines.length-1&&lines.slice(index+1).some(next=>next.trim()))text+=' ';}});
              if (/[a-zA-Z]/.test(text)) {
                // HTML option values must remain English when no explicit value exists.
                const opening = path.parent?.openingElement;
                if(opening?.name?.name === 'option' && !opening.attributes.some(attr=>attr.name?.name==='value'))opening.attributes.push(t.jsxAttribute(t.jsxIdentifier('value'),t.stringLiteral(text.trim())));
                path.replaceWith(t.jsxExpressionContainer(call(t.stringLiteral(text))));
              }
            },
            JSXAttribute(path) {
              const name = path.node.name.name;
              const tag = path.parent.name;
              if(t.isJSXIdentifier(tag)&&['Area','Bar','Line','Radar','Pie'].includes(tag.name)&&name==='name') {
                if(t.isStringLiteral(path.node.value))path.node.value=t.jsxExpressionContainer(call(path.node.value));
                return;
              }
              // Custom component props can also serve as internal identifiers.
              // Translate them only when their labels are actually rendered.
              if(!t.isJSXIdentifier(tag)||!/^[a-z]/.test(tag.name))return;
              if (!['label','title','placeholder','aria-label','alt'].includes(name)) return;
              if(t.isStringLiteral(path.node.value)) path.node.value=t.jsxExpressionContainer(call(path.node.value));
              else if(t.isJSXExpressionContainer(path.node.value)&&!t.isJSXEmptyExpression(path.node.value.expression))path.node.value.expression=call(path.node.value.expression);
            },
            JSXExpressionContainer(path) {
              if(t.isJSXAttribute(path.parent)) return;
              // UI labels only. Account names, notes, rules and trade values are deliberately excluded.
              const expr = path.node.expression;
              if(t.isIdentifier(expr)&&(['label','title'].includes(expr.name)||(id.includes('PublicSite.jsx')&&['body','text'].includes(expr.name)))) path.node.expression=call(expr);
              else if(t.isMemberExpression(expr)&&!expr.computed&&['label','title'].includes(expr.property.name)&&!(id.includes('JournalControls.jsx')&&expr.object.name==='option'))path.node.expression=call(expr);
              else path.node.expression=display(expr);
            },
            CallExpression(path) {
              const callee=path.node.callee;
              if(t.isMemberExpression(callee)&&['toLocaleDateString','toLocaleTimeString'].includes(callee.property.name)){
                const first=path.node.arguments[0];
                if(!first||t.isIdentifier(first,{name:'undefined'})||(t.isStringLiteral(first)&&/^en(?:-|$)/.test(first.value))){path.node.arguments[0]=t.callExpression(t.identifier('__tjDateLocale'),[]);used=true;}
              }
            },
            Program:{exit(path){if(used)path.unshiftContainer('body',t.importDeclaration([t.importSpecifier(t.identifier('__tjTranslate'),t.identifier('translate')),t.importSpecifier(t.identifier('__tjTemplate'),t.identifier('translateTemplate')),t.importSpecifier(t.identifier('__tjDateLocale'),t.identifier('getDateLocale'))],t.stringLiteral('/src/localization.js')));}},
          }};
        }],
      });
      return {code:result.code,map:result.map};
    },
  };
}
