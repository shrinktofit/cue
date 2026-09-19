import { beforeAll, describe, expect, it } from 'vitest';
import { CueBorderStyle, CueOverflow } from '@bsgames/cue-style-schema';
import { DivElement } from '../src/element/div-element.js';
import { getCueElementProperties, getCueElementStates } from '../src/element/cue-element.js';
import { createCuePaintList, initializeCueLayout, type CueTextMeasurer } from '../src/render/create-cue-paint-list.js';
import { CueRootElement } from '../src/element/cue-root-element.js';
import { CueButtonElement } from '../src/builtin-controls/button/cue-button-element.js';
import { CueToggleElement } from '../src/builtin-controls/toggle/cue-toggle-element.js';
import { CueSliderElement, updateCueSliderLayout } from '../src/builtin-controls/slider/cue-slider-element.js';
import { CueSelectElement, updateCueSelectLayout } from '../src/builtin-controls/select/cue-select-element.js';
import { CueTextInputElement } from '../src/builtin-controls/text-input/cue-text-input-element.js';
import { CueNumberInputElement } from '../src/builtin-controls/number-input/cue-number-input-element.js';
import { CueFocusController } from '../src/input/cue-focus-controller.js';
import { CuePointerEvent } from '../src/input/cue-pointer-event.js';

describe('native control interaction', () => {
  beforeAll(initializeCueLayout);
  const measurer: CueTextMeasurer = {
    metrics: () => ({ ascent: 12, descent: 4, xHeight: 8, lineHeight: 16 }),
    layout: (text) => ({ width: text.length * 8, height: 16, lines: [{ text, width: text.length * 8 }] }),
  };

  it.each([CueButtonElement, CueToggleElement, CueSliderElement, CueSelectElement, CueTextInputElement, CueNumberInputElement].map((Control) => ({ name: Control.name, Control })))('lays out $name without author CSS or flex blockification', ({ Control }) => {
    /// @case Each control is mounted in normal block flow after an offset spacer.
    /// @expect Default styling produces a nonempty box without requiring author CSS.
    const root = new CueRootElement();
    const container = new DivElement();
    root.insertBefore(container);
    const spacer = new DivElement();
    Object.assign(spacer.style, { width: 100, height: 80 });
    container.insertBefore(spacer);
    const control = new Control();
    control.style.marginLeft = 60;
    container.insertBefore(control);
    const paint = createCuePaintList(root, [], measurer, () => undefined, () => undefined, { width: 800, height: 600 });
    const box = paint.hitRegions.find((region) => region.element === control)!;
    expect(box.x).toBe(60);
    expect(box.y).toBe(80);
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
  });

  it('lays out native control parts inside their host and paints popup above ancestor clips', () => {
    /// @case A select inside a clipped, offset container is opened without author control CSS.
    /// @expect Its label/arrow remain within its host; options escape ancestor clipping in a top layer.
    const root = new CueRootElement();
    const container = new DivElement();
    Object.assign(container.style, { width: 400, height: 80, marginLeft: 100, marginTop: 60, overflowX: CueOverflow.hidden, overflowY: CueOverflow.hidden });
    root.insertBefore(container);
    const select = new CueSelectElement();
    select.options = [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }];
    container.insertBefore(select);
    select.open = true;
    const paint = createCuePaintList(root, [], measurer, () => undefined, () => undefined, { width: 800, height: 600 });
    const host = paint.hitRegions.find((region) => region.element === select)!;
    const arrow = paint.hitRegions.find((region) => getCueElementProperties(region.element).get('class') === 'cue-select-arrow')!;
    expect(arrow.x).toBeGreaterThanOrEqual(host.x);
    expect(arrow.x + arrow.width).toBeLessThanOrEqual(host.x + host.width);
    const row = paint.hitRegions.find((region) => getCueElementProperties(region.element).get('class') === 'cue-select-option')!;
    expect(row.clips).toHaveLength(1);
    expect(row.clips[0]!.y).toBeGreaterThanOrEqual(host.y + host.height);
    expect(row.y).toBeGreaterThanOrEqual(host.y + host.height);
  });

  it('fits custom-sized slider thumbs and dropdown option rows to actual layout', () => {
    /// @case Author CSS changes thumb and option sizes; the document has limited popup space.
    /// @expect Thumb centers meet track endpoints; popup stays inside the available viewport.
    const root = new CueRootElement();
    const container = new DivElement();
    Object.assign(container.style, { width: 800, height: 310 });
    root.insertBefore(container);
    const slider = new CueSliderElement();
    slider.value = 100;
    container.insertBefore(slider);
    const select = new CueSelectElement();
    select.options = Array.from({ length: 10 }, (_, index) => ({ value: String(index), label: String(index) }));
    select.open = true;
    container.insertBefore(select);
    const sheets = [{ version: 1 as const, rules: [
      { selectors: [[{ type: 'class' as const, name: 'cue-slider-thumb' }]], declarations: { width: 40, height: 40 } },
      { selectors: [[{ type: 'class' as const, name: 'cue-select-option' }]], declarations: { height: 50, paddingTop: 10 } },
      { selectors: [[{ type: 'class' as const, name: 'cue-select-popup' }]], declarations: { paddingTop: 10, paddingBottom: 10 } },
    ] }];
    const paint = () => createCuePaintList(root, sheets, measurer, () => undefined, () => undefined, { width: 800, height: 310 });
    let list = paint();
    updateCueSliderLayout(slider, list.hitRegions);
    updateCueSelectLayout(select, 310, list.hitRegions);
    list = paint();
    const part = (name: string) => list.hitRegions.find((region) => getCueElementProperties(region.element).get('class') === name)!;
    expect(part('cue-slider-thumb').x + 20).toBe(part('cue-slider-track').x + part('cue-slider-track').width);
    expect(part('cue-slider-thumb').y + 20).toBe(part('cue-slider-track').y + part('cue-slider-track').height / 2);
    expect(part('cue-select-popup').y + part('cue-select-popup').height).toBeLessThanOrEqual(310);
    const focus = new CueFocusController(root);
    select.focus();
    focus.handle('keydown', { key: 'End' });
    list = paint();
    updateCueSelectLayout(select, 310, list.hitRegions);
    list = paint();
    const lastRow = list.hitRegions.filter((region) => getCueElementProperties(region.element).get('class') === 'cue-select-option').at(-1)!;
    const popup = part('cue-select-popup');
    expect(lastRow.y + lastRow.height).toBe(popup.y + popup.height - 10);
    focus.dispose();
  });

  it.each([{ viewportHeight: 310, borderWidth: 0 }, { viewportHeight: 32, borderWidth: 10 }])('fits a padded popup in a $viewportHeight px viewport with $borderWidth px host borders', ({ viewportHeight, borderWidth }) => {
    /// @case A full-height select leaves no space above or below its host.
    /// @expect The popup overlaps its host instead of overflowing with a zero-height padded box.
    const root = new CueRootElement();
    const select = new CueSelectElement();
    Object.assign(select.style, {
      borderTopStyle: CueBorderStyle.solid, borderBottomStyle: CueBorderStyle.solid,
      borderTopWidth: borderWidth, borderBottomWidth: borderWidth,
    });
    select.options = Array.from({ length: 10 }, (_, index) => ({ value: String(index), label: String(index) }));
    select.open = true;
    root.insertBefore(select);
    const sheets = [{ version: 1 as const, rules: [
      { selectors: [[{ type: 'class' as const, name: 'cue-select-popup' }]], declarations: { paddingTop: 10, paddingBottom: 10 } },
    ] }];
    const paint = () => createCuePaintList(root, sheets, measurer, () => undefined, () => undefined, { width: 800, height: viewportHeight });
    let list = paint();
    const host = list.hitRegions.find((region) => region.element === select)!;
    expect(host.height).toBeGreaterThanOrEqual(viewportHeight);
    updateCueSelectLayout(select, viewportHeight, list.hitRegions);
    list = paint();
    const popup = list.hitRegions.find((region) => getCueElementProperties(region.element).get('class') === 'cue-select-popup')!;
    expect(popup.y).toBeGreaterThanOrEqual(0);
    expect(popup.y + popup.height).toBeLessThanOrEqual(viewportHeight);
    expect(popup.height).toBeGreaterThan(20);
  });

  it('closes a select popup when the viewport cannot contain its padding', () => {
    /// @case The viewport is smaller than the authored popup padding.
    /// @expect The popup closes rather than drawing an overflowing, unusable box.
    const root = new CueRootElement();
    const select = new CueSelectElement();
    select.options = [{ value: 'a', label: 'A' }];
    select.open = true;
    root.insertBefore(select);
    const sheets = [{ version: 1 as const, rules: [
      { selectors: [[{ type: 'class' as const, name: 'cue-select-popup' }]], declarations: { paddingTop: 10, paddingBottom: 10 } },
    ] }];
    const paint = createCuePaintList(root, sheets, measurer, () => undefined, () => undefined, { width: 800, height: 16 });
    expect(updateCueSelectLayout(select, 16, paint.hitRegions)).toBe(true);
    expect(select.open).toBe(false);
  });

  it('opens upwards near the bottom edge and can switch back to downwards', () => {
    /// @case A select extends past the document bottom, then moves to the top.
    /// @expect Its popup explicitly overrides the default top inset in both directions.
    const root = new CueRootElement();
    const container = new DivElement();
    Object.assign(container.style, { width: 800, height: 310 });
    root.insertBefore(container);
    const spacer = new DivElement();
    spacer.style.height = 280;
    container.insertBefore(spacer);
    const select = new CueSelectElement();
    select.options = Array.from({ length: 10 }, (_, index) => ({ value: String(index), label: String(index) }));
    select.open = true;
    container.insertBefore(select);
    const paint = () => createCuePaintList(root, [], measurer, () => undefined, () => undefined, { width: 800, height: 310 });
    let list = paint();
    updateCueSelectLayout(select, 310, list.hitRegions);
    list = paint();
    const part = () => list.hitRegions.find((region) => getCueElementProperties(region.element).get('class') === 'cue-select-popup')!;
    expect(part().y).toBeGreaterThanOrEqual(0);
    expect(part().y + part().height).toBe(280);
    spacer.style.height = 0;
    list = paint();
    updateCueSelectLayout(select, 310, list.hitRegions);
    list = paint();
    expect(part().y).toBe(select.clientHeight);
    expect(part().y + part().height).toBeLessThanOrEqual(310);
  });

  it('activates a button once per keyboard gesture and lets an ancestor cancel', () => {
    /// @case Enter/Space, repeated keydown, ancestor cancellation and disabled button.
    /// @expect Exactly one click per gesture; prevented and disabled gestures do not activate.
    const root = new CueRootElement();
    const button = new CueButtonElement();
    root.insertBefore(button);
    const focus = new CueFocusController(root);
    button.focus();
    let clicks = 0;
    button.addEventListener('click', () => {
      clicks += 1;
    });
    focus.handle('keydown', { key: 'Enter' });
    focus.handle('keydown', { key: 'Enter', repeat: true });
    focus.handle('keyup', { key: 'Enter' });
    focus.handle('keydown', { key: ' ' });
    focus.handle('keyup', { key: ' ' });
    expect(clicks).toBe(2);
    root.addEventListener('keydown', (event) => event.preventDefault());
    focus.handle('keydown', { key: 'Enter' });
    expect(clicks).toBe(2);
    button.disabled = true;
    expect(focus.activeElement).toBeUndefined();
    focus.dispose();
  });

  it('distinguishes user toggle edits from assignments and restores defaults on removal', () => {
    /// @case A toggle receives assignment, click, canceled click and disable.
    /// @expect Only uncanceled user activation emits input followed by change.
    const root = new CueRootElement();
    const toggle = new CueToggleElement();
    root.insertBefore(toggle);
    const values: unknown[] = [];
    toggle.addEventListener('input', (event) => values.push(event.value));
    toggle.addEventListener('change', (event) => values.push(event.value));
    toggle.value = true;
    expect(values).toEqual([]);
    toggle.dispatchEvent(new CuePointerEvent('click', { bubbles: true, cancelable: true }));
    expect(values).toEqual([false, false]);
    root.addEventListener('click', (event) => event.preventDefault());
    toggle.dispatchEvent(new CuePointerEvent('click', { bubbles: true, cancelable: true }));
    expect(toggle.value).toBe(false);
    expect(values).toEqual([false, false]);
  });

  it('steps sliders precisely and commits once on key release', () => {
    /// @case Decimal stepping, key repeats and range endpoints.
    /// @expect Snapped finite values, live inputs, one change at the end of a gesture.
    const root = new CueRootElement();
    const slider = new CueSliderElement();
    root.insertBefore(slider);
    const focus = new CueFocusController(root);
    slider.max = 1;
    slider.step = 0.1;
    slider.focus();
    const inputs: unknown[] = [];
    const changes: unknown[] = [];
    slider.addEventListener('input', (event) => inputs.push(event.value));
    slider.addEventListener('change', (event) => changes.push(event.value));
    focus.handle('keydown', { key: 'ArrowRight' });
    focus.handle('keydown', { key: 'ArrowRight', repeat: true });
    focus.handle('keydown', { key: 'ArrowRight', repeat: true });
    expect(inputs).toEqual([0.1, 0.2, 0.3]);
    expect(changes).toEqual([]);
    focus.handle('keyup', { key: 'ArrowRight' });
    expect(changes).toEqual([0.3]);
    slider.value = 9;
    expect(slider.value).toBe(1);
    expect(changes).toEqual([0.3]);
    slider.max = 10;
    slider.value = 20;
    expect(slider.value).toBe(10);
    slider.max = 30;
    slider.value = 20;
    expect(slider.value).toBe(20);
    expect(() => {
      slider.step = 0;
    }).toThrow(RangeError);
    expect(() => {
      slider.step = 0;
    }).toThrow(RangeError);
    expect(slider.step).toBe(0.1);
    focus.dispose();
  });

  it('keeps select candidates separate from selection and skips disabled options', () => {
    /// @case Open a select, navigate over a disabled option, escape, reopen and confirm.
    /// @expect Escape preserves the selected value; Enter emits the chosen value once.
    const root = new CueRootElement();
    const select = new CueSelectElement();
    root.insertBefore(select);
    const focus = new CueFocusController(root);
    select.options = [{ value: 'a', label: 'A' }, { value: 'b', label: 'B', disabled: true }, { value: 'c', label: 'C' }];
    select.value = 'a';
    select.focus();
    const changes: unknown[] = [];
    select.addEventListener('change', (event) => changes.push(event.value));
    focus.handle('keydown', { key: 'Enter' });
    focus.handle('keydown', { key: 'ArrowDown' });
    expect(select.value).toBe('a');
    focus.handle('keydown', { key: 'Escape' });
    expect(select.open).toBe(false);
    expect(changes).toEqual([]);
    focus.handle('keydown', { key: 'Enter' });
    focus.handle('keydown', { key: 'ArrowDown' });
    focus.handle('keydown', { key: 'Enter' });
    expect(select.value).toBe('c');
    expect(changes).toEqual(['c']);
    focus.dispose();
  });

  it('preserves focus on moves but clears it on detach and skips disabled Tab candidates', () => {
    /// @case Reorder a focused control, traverse past a disabled control and detach.
    /// @expect Moves preserve focus; Tab and detach leave no stale active element.
    const root = new CueRootElement();
    const first = new CueButtonElement();
    const skipped = new CueButtonElement();
    const last = new CueButtonElement();
    skipped.disabled = true;
    root.insertBefore(first);
    root.insertBefore(skipped);
    root.insertBefore(last);
    const focus = new CueFocusController(root);
    first.focus();
    const previousParent = new DivElement();
    const nextParent = new DivElement();
    root.insertBefore(previousParent);
    root.insertBefore(nextParent);
    previousParent.insertBefore(first);
    expect(getCueElementStates(previousParent).has('focus-within')).toBe(true);
    nextParent.insertBefore(first);
    expect(getCueElementStates(previousParent).has('focus-within')).toBe(false);
    expect(getCueElementStates(nextParent).has('focus-within')).toBe(true);
    root.insertBefore(first, skipped);
    expect(focus.activeElement).toBe(first);
    focus.handle('keydown', { key: 'Tab' });
    expect(focus.activeElement).toBe(last);
    root.removeChild(last);
    expect(focus.activeElement).toBeUndefined();
    focus.dispose();
  });

  it('does not announce stale focus after a focus listener redirects it', () => {
    /// @case A focus listener synchronously focuses a different control.
    /// @expect Only the final active control receives focusin.
    const root = new CueRootElement();
    const first = new CueButtonElement();
    const second = new CueButtonElement();
    root.insertBefore(first);
    root.insertBefore(second);
    const focus = new CueFocusController(root);
    const targets: unknown[] = [];
    root.addEventListener('focusin', (event) => targets.push(event.target));
    first.addEventListener('focus', () => second.focus());
    first.focus();
    expect(focus.activeElement).toBe(second);
    expect(targets).toEqual([second]);
    focus.dispose();
  });

  it('cancels rather than commits a slider gesture when disabled', () => {
    /// @case Disable a slider after keydown changed its live value but before keyup.
    /// @expect The live value remains, focus clears, and no completed change is emitted.
    const root = new CueRootElement();
    const slider = new CueSliderElement();
    root.insertBefore(slider);
    const focus = new CueFocusController(root);
    slider.focus();
    const changes: unknown[] = [];
    slider.addEventListener('change', (event) => changes.push(event.value));
    focus.handle('keydown', { key: 'ArrowRight' });
    slider.disabled = true;
    expect(slider.value).toBe(1);
    expect(focus.activeElement).toBeUndefined();
    expect(changes).toEqual([]);
    focus.dispose();
  });
});
