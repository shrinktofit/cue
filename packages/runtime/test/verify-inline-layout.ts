import assert from 'node:assert/strict';
import process from 'node:process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const repository = fileURLToPath(new URL('../../..', import.meta.url));
const runtime = join(repository, 'packages/runtime');
const requireRuntime = createRequire(join(runtime, 'package.json'));
const { createServer } = await import(pathToFileURL(requireRuntime.resolve('vite')).href);
const { chromium } = await import(pathToFileURL(join(process.argv[2] ?? 'U:/AgentTools/playwright/node_modules/playwright', 'index.mjs')).href);
const wasm = join(dirname(fileURLToPath(import.meta.resolve('taffy-layout/wasm'))), 'taffy_wasm_bg.wasm').replaceAll('\\', '/');
const server = await createServer({
  configFile: false,
  root: runtime,
  server: { host: '127.0.0.1', port: 0 },
  plugins: [{
    name: 'cue:inline-layout-browser-test',
    enforce: 'pre',
    resolveId(id: string) {
      if (id.endsWith('load-cue-font.js')) return '\0cue-inline-system-font';
      return id.endsWith('taffy_wasm_bg.wasm?wasm-binary') ? '\0cue-inline-test-wasm' : undefined;
    },
    load(id: string) {
      // This comparison uses installed system fonts, not the Cocos asset loader.
      if (id === '\0cue-inline-system-font') return 'export const cueFontRevision = 0;';
      return id === '\0cue-inline-test-wasm' ? `export default new Uint8Array(await (await fetch('/@fs/${wasm}')).arrayBuffer());` : undefined;
    },
  }],
});
await server.listen();
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error: Error) => {
    errors.push(String(error));
    console.error(error);
  });
  await page.goto(server.resolvedUrls.local[0]);
  await page.addScriptTag({ type: 'module', content: `
    import { CueRootElement, CueButtonElement, DivElement, SpanElement, BrElement, Text, Length } from '/src/index.ts';
    import { CueLayout, createCuePaintList, initializeCueLayout } from '/src/render/create-cue-paint-list.ts';
    import { CanvasTextRasterizer } from '/src/host/canvas-text-rasterizer.ts';
    await initializeCueLayout();
    const rasterizer = new CanvasTextRasterizer(() => 1);
    const span = (children, style = {}) => ({ tag: 'span', children: Array.isArray(children) ? children : [children], style });
    const cases = [
      { name: 'plain', children: ['Hello world, Cue!'] },
      {name:'percent-constrained-height',children:['A',span([],{display:'inline-block',width:30,height:'50%'}),'B'],style:{height:100,maxHeight:50}},
      {name:'percent-constrained-anonymous-height',children:['A',span([],{display:'inline-block',width:30,height:'50%'}),'B',{tag:'div',children:['C']}],style:{height:50,minHeight:100}},
      {name:'sub-outofflow-anchor',children:['A',span(['B',span('C',{position:'absolute',left:0,top:0}),'D'],{verticalAlign:'sub'}),'Z'],style:{position:'relative'}},
      {name:'nested-atomic-containingblock',children:['A',span([span([span('B',{position:'absolute',left:50,top:30,width:10,height:10})],{display:'inline-block',width:40,height:40})],{display:'inline-block',position:'relative',width:100,height:80}),'C'],style:{paddingLeft:20,paddingTop:10,width:200}},
      {name:'percent-with-block',children:['A',span([],{display:'inline-block',width:30,height:'50%'}),'B',{tag:'div',children:['C']}],style:{height:100}},
      {name:'abs-auto-inline',children:['A',span('B',{position:'absolute'}),'C'],style:{position:'relative'}},
      {name:'relative-span-containingblock',children:['A',span(['B',span('C',{position:'absolute',left:0,top:0})],{position:'relative',left:20,top:10}),'D'],style:{position:'relative'}},
      {name:'nested-sub-top',children:['A',span(['B',span('C',{fontSize:40,lineHeight:20,verticalAlign:'top'}),'D'],{fontSize:10,lineHeight:36,verticalAlign:'sub'}),'Z']},
      { name: 'absolute-inline-child', children: ['A', span([], {position: 'absolute', left: 0, top: 0, width: 5, height: 5}), 'B'], style: {position: 'relative'} },
      { name: 'relative-inline-child', children: ['A', span('B', {position: 'relative', left: 20, top: 10}), 'C'] },
      { name: 'relative-inline-block-interruption', children: [span(['A', {tag: 'div', children: ['B'], style: {height: 30}}, 'C'], {position: 'relative', left: 20, top: 10})] },
      { name: 'atomic-absolute-containingblock', children: ['A', span([span('B', {position: 'absolute', left: 50, top: 30, width: 10, height: 10})], {display: 'inline-block', width: 40, height: 40}), 'C'], style: {position: 'relative', paddingLeft: 20, paddingTop: 10, width: 200} },
      { name: 'atomic-percent-height', children: ['A', span([], {display: 'inline-block', width: 30, height: '50%'}), 'B'], style: {height: 100} },
      { name: 'nested-middle-subtree', children: ['A', span(['B', span('C', {fontSize: 40, lineHeight: 60}), 'D'], {fontSize: 10, lineHeight: 36, verticalAlign: 'middle'}), 'Z'] },
      { name: 'nested-text-top-subtree', children: ['A', span(['B', span('C', {fontSize: 40, lineHeight: 60}), 'D'], {fontSize: 10, lineHeight: 36, verticalAlign: 'text-top'}), 'Z'] },
      { name: 'mixed-font-baseline', children: ['Small ', span('BIG', {fontSize: 32, lineHeight: 38}), ' tail'] },
      { name: 'nested-baseline', children: ['A', span(['B', span('C', {fontSize: 30, lineHeight: 24}), 'D'], {fontSize: 20, lineHeight: 30}), 'E'] },
      ...['baseline', 'middle', 'top', 'bottom', 'text-top', 'text-bottom', 'sub', 'super', '25%', '5px'].map(verticalAlign => ({ name: 'vertical-' + verticalAlign, children: ['A', span('Big', {fontSize: 32, lineHeight: 36, verticalAlign}), 'Z'] })),
      { name: 'cross-run-collapse', children: ['  Hello ', span(['  world ', span('  Cue')]), '  end  '], style: {width: 100} },
      { name: 'cross-run-word', children: ['A ', span('unbreak'), span('ableword'), ' tail'], style: {width: 75} },
      { name: 'preserved-breaks', children: ['A\\n\\nB\\n'], style: {whiteSpace: 'pre-wrap'} },
      { name: 'br', children: ['A', {tag: 'br', children: []}, 'B', {tag: 'br', children: []}, {tag: 'br', children: []}, 'C'] },
      { name: 'atomic', children: ['A ', span('B', {display: 'inline-block', width: 30, height: 40, marginLeft: 4, marginRight: 6}), ' C'] },
      { name: 'atomic-empty', children: ['A', span([], {display: 'inline-block', width: 30, height: 40}), 'B'] },
      { name: 'inline-decoration', children: ['A ', span('one two three four', {padding: '3px 6px', border: '2px solid red'}), ' B'], style: {width: 100} },
      { name: 'block-interruption', children: ['before', {tag: 'div', children: ['middle'], style: {height: 30}}, 'after'] },
      { name: 'nested-block-interruption', children: [span(['before', {tag: 'div', children: ['middle'], style: {height: 30}}, 'after'])] },
      { name: 'flex-text', children: ['Launch'], style: {display: 'flex', alignItems: 'center', justifyContent: 'center', height: 60} },
      // Real Canvas font advances must not acquire an extra line after layout.
      // Include insufficient widths and nowrap as controls, not just ample space.
      ...[20, 40, 42.2, 42.234375, 42.25, 45, 50, 70].flatMap(width => ['normal', 'nowrap'].map(whiteSpace => ({
        name: 'button-fractional-' + width + '-' + whiteSpace,
        tag: 'cue-button',
        children: ['click / hover'],
        style: {width, minWidth: 0, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 19, paddingLeft: 4, paddingRight: 4, fontSize: 8, lineHeight: 10, textAlign: 'center', whiteSpace},
      }))),
      { name: 'flex-mixed', children: ['A', span('B'), 'C'], style: {display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60} },
    ];
    const results = [];
    for (const example of cases) {
      const textNodes = [];
      const make = (definition) => {
        if (typeof definition === 'string') {
          const dom = document.createTextNode(definition);
          textNodes.push(dom);
          return {dom, cue: new Text(definition)};
        }
        const dom = document.createElement(definition.tag);
        const cue = definition.tag === 'cue-button' ? new CueButtonElement() : definition.tag === 'div' ? new DivElement() : definition.tag === 'br' ? new BrElement() : new SpanElement();
        for (const [name, value] of Object.entries(definition.style ?? {})) {
          dom.style[name] = typeof value === 'number' && !['flexGrow', 'flexShrink', 'order'].includes(name) ? value + 'px' : value;
          if (name === 'lineHeight') cue.style[name] = Length.px(value);
          else if (name === 'padding') {
            const [top, right = top] = value.split(' ').map(parseFloat);
            Object.assign(cue.style, {paddingTop: top, paddingBottom: top, paddingLeft: right, paddingRight: right});
          } else if (name === 'border') {
            for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
              cue.style['border' + side + 'Width'] = 2; cue.style['border' + side + 'Style'] = 'solid';
            }
          } else if (name === 'verticalAlign' && value.endsWith('%')) cue.style[name] = Length.percent(parseFloat(value));
          else if (name === 'verticalAlign' && value.endsWith('px')) cue.style[name] = Length.px(parseFloat(value));
          else cue.style[name] = value;
        }
        for (const child of definition.children) {
          const pair = make(child); dom.appendChild(pair.dom); cue.insertBefore(pair.cue);
        }
        return {dom, cue};
      };
      const pair = make({tag: example.tag ?? 'div', style: {width: 180, fontFamily: 'Arial', fontSize: 16, lineHeight: 20, ...example.style}, children: example.children});
      // Font-family is a list in Cue's typed API.
      pair.cue.style.fontFamily = ['Arial'];
      document.body.appendChild(pair.dom);
      const origin = pair.dom.getBoundingClientRect();
      const expected = [];
      for (const text of textNodes) {
        const font = getComputedStyle(text.parentElement);
        const ctx = document.createElement('canvas').getContext('2d'); ctx.font = font.font;
        const ascent = ctx.measureText('Mg').fontBoundingBoxAscent;
        for (let index = 0; index < text.length; index++) {
          if (/\\s/.test(text.data[index])) continue;
          const range = document.createRange(); range.setStart(text, index); range.setEnd(text, index + 1);
          const rect = range.getBoundingClientRect();
          expected.push({text: text.data[index], x: rect.x - origin.x, baseline: rect.y - origin.y + ascent});
        }
      }
      const root = new CueRootElement(); root.insertBefore(pair.cue);
      const paint = createCuePaintList(root, [], rasterizer, () => undefined, () => undefined);
      const actual = [];
      for (const command of paint.commands) {
        if (command.kind !== 'text') continue;
        const item = command.paint;
        const metrics = rasterizer.metrics(item.style);
        const baseline = -item.y + Math.floor((metrics.lineHeight - metrics.ascent - metrics.descent) / 2) + metrics.ascent;
        for (const line of item.lines) {
          for (let index = 0; index < line.text.length; index++) {
            if (/\\s/.test(line.text[index])) continue;
            const prefix = rasterizer.layout(line.text.slice(0, index), {...item.style, whiteSpace: 'pre'}).width;
            const [a, b, c, d, e, f] = item.transform;
            const x = item.x + line.x + prefix;
            actual.push({text: line.text[index], x: a * x + c * baseline + e, baseline: b * x + d * baseline + f});
          }
        }
      }
      const box = paint.hitRegions.find(region => region.element === pair.cue);
      // Positioned content paints in a different phase, but must retain its glyph geometry.
      const compare = (a, b) => a.text.localeCompare(b.text) || a.baseline - b.baseline || a.x - b.x;
      expected.sort(compare); actual.sort(compare);
      const mismatch = expected.length !== actual.length || expected.some((entry, index) => entry.text !== actual[index]?.text || Math.abs(entry.x - actual[index].x) > 0.6 || Math.abs(entry.baseline - actual[index].baseline) > 0.6);
      results.push({name: example.name, ok: !mismatch && Math.abs(origin.height - box.height) < 0.6, expectedHeight: origin.height, actualHeight: box.height, ...(mismatch ? {expected, actual} : {})});
      pair.dom.remove();
    }
    // Black-box Canvas calls guard the original per-prefix/per-frame regression.
    const originalMeasureText = CanvasRenderingContext2D.prototype.measureText;
    let calls = 0;
    CanvasRenderingContext2D.prototype.measureText = function(text) {
      calls++;
      return originalMeasureText.call(this, text);
    };
    const performanceResults = [];
    try {
      for (const text of ['A short line of text.', 'alpha beta gamma delta '.repeat(8)]) {
        const root = new CueRootElement();
        const block = new DivElement();
        block.style.width = 5000;
        block.insertBefore(new Text(text));
        root.insertBefore(block);
        const layout = new CueLayout(root, new CanvasTextRasterizer(() => 1), () => undefined, () => undefined);
        try {
          calls = 0;
          const first = layout.update([]);
          const coldCalls = calls;
          calls = 0;
          let reused = true;
          for (let frame = 0; frame < 120; frame++) reused &&= layout.update([]) === first;
          const staticCalls = calls;
          block.style.color = {red: 255, green: 0, blue: 0, alpha: 1};
          layout.update([]);
          performanceResults.push({characters: text.length, coldCalls, staticCalls, colorCalls: calls - staticCalls, reused});
        } finally {
          layout.dispose();
        }
      }
    } finally {
      CanvasRenderingContext2D.prototype.measureText = originalMeasureText;
    }
    window.cueInlinePerformance = performanceResults;
    window.cueInlineResults = results;
  ` });
  await page.waitForFunction('window.cueInlineResults', { timeout: 30000 });
  const results = await page.evaluate('window.cueInlineResults');
  console.log(JSON.stringify(results, undefined, 2));
  assert.deepEqual(errors, []);
  assert.equal(results.filter((result: { ok: boolean }) => !result.ok).length, 0, 'Cue inline layout must match the browser reference');
  const performanceResults = await page.evaluate('window.cueInlinePerformance') as Array<{
    characters: number; coldCalls: number; staticCalls: number; colorCalls: number; reused: boolean;
  }>;
  console.log('Canvas measurement regression:', performanceResults);
  for (const result of performanceResults) {
    assert.ok(result.coldCalls < result.characters * 4, 'Cold layout must not repeatedly reshape identical prefixes');
    assert.equal(result.staticCalls, 0);
    assert.equal(result.colorCalls, 0);
    assert.equal(result.reused, true);
  }
} finally {
  await browser.close();
  await server.close();
}

export {};
