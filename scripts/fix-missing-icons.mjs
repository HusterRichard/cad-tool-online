import fs from 'fs';
const penPath = 'cadtoolonline.pen';
const pen = JSON.parse(fs.readFileSync(penPath, 'utf8'));

function F(id, props, children = []) {
  return { type: 'frame', id, ...props, children };
}

// Missing icon definitions
const MISSING_32 = {
  screw: (id) => F(id, { width: 32, height: 32, fill: '#FEF2F2', cornerRadius: 6 }, [
    F(id + '_S1', { x: 14, y: 4, width: 4, height: 20, fill: '#DC2626', cornerRadius: 1 }),
    F(id + '_S2', { x: 11, y: 8, width: 10, height: 2, fill: '#FCA5A5' }),
    F(id + '_S3', { x: 11, y: 13, width: 10, height: 2, fill: '#FCA5A5' }),
    F(id + '_S4', { x: 11, y: 18, width: 10, height: 2, fill: '#FCA5A5' }),
    F(id + '_S5', { x: 15, y: 24, width: 2, height: 4, fill: '#DC2626' }),
  ]),
  check: (id) => F(id, { width: 32, height: 32, fill: '#F3F4F6', cornerRadius: 6 }, [
    F(id + '_S1', { x: 5, y: 5, width: 22, height: 22, fill: '#FFFFFF', cornerRadius: 11, stroke: '#4B5563', strokeWidth: 2 }),
    F(id + '_S2', { x: 9, y: 16, width: 5, height: 3, fill: '#4B5563' }),
    F(id + '_S3', { x: 13, y: 11, width: 3, height: 10, fill: '#4B5563' }),
  ]),
  about: (id) => F(id, { width: 32, height: 32, fill: '#F5F3FF', cornerRadius: 6 }, [
    F(id + '_S1', { x: 6, y: 6, width: 20, height: 20, fill: '#FFFFFF', cornerRadius: 10, stroke: '#9333EA', strokeWidth: 2 }),
    F(id + '_S2', { x: 15, y: 11, width: 2, height: 2, fill: '#9333EA', cornerRadius: 1 }),
    F(id + '_S3', { x: 14, y: 15, width: 4, height: 8, fill: '#9333EA', cornerRadius: 1 }),
  ]),
};

// ID patterns that need fixing
const FIXES = [
  { pattern: '_BTN_SCREW_ICO', icon: 'screw' },
  { pattern: '_BTN_SCR_ICO', icon: 'screw' },
  { pattern: '_BTN_CHECK_ICO', icon: 'check' },
  { pattern: '_BTN_CHK_ICO', icon: 'check' },
  { pattern: '_BTN_ABOUT_ICO', icon: 'about' },
  { pattern: '_BTN_ABT_ICO', icon: 'about' },
];

function walk(node) {
  if (!node || !Array.isArray(node.children)) return;
  for (let i = 0; i < node.children.length; i++) {
    const c = node.children[i];
    if (!c || !c.id) continue;
    if (c.width === 32 && c.height === 32 && (!c.children || c.children.length === 0)) {
      for (const fix of FIXES) {
        if (c.id.endsWith(fix.pattern)) {
          node.children[i] = MISSING_32[fix.icon](c.id);
          break;
        }
      }
    }
    walk(c);
  }
}

let count = 0;
for (const screen of pen.children) {
  walk(screen);
  count++;
}

fs.writeFileSync(penPath, JSON.stringify(pen, null, 2) + '\n', 'utf8');
console.log('Fixed remaining empty icons in ' + count + ' screens');
