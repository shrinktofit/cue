import { CueBoxSizing, CueDimensionKeyword, CueDisplay, CueFlexDirection, CueOverflow, CuePointerEvents, CuePosition, CueWhiteSpace } from '@bsgames/cue-style-schema';
import { cueTopLayerElements } from '../../render/cue-top-layer.js';
import { CueElement, getCueElementContentBox, setCueElementDefaultStyle, setCueElementState } from '../../element/cue-element.js';
import { Text } from '../../element/text.js';
import type { CueEvent } from '../../input/cue-event.js';
import { CueKeyboardEvent } from '../../input/cue-keyboard-event.js';
import { CueWheelEvent } from '../../input/cue-wheel-event.js';
import { CueInputEvent, CueChangeEvent } from '../../input/cue-value-event.js';
import type { CueHitRegion } from '../../input/cue-hit-region.js';
import { createControlPart } from '../control-part.js';
import { CueControlElement } from '../cue-control-element.js';

export interface CueSelectOption {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

export let updateCueSelectLayout: (element: CueSelectElement, viewportHeight: number, regions: readonly CueHitRegion[]) => boolean;

export class CueSelectElement extends CueControlElement {
  constructor() {
    super('cue-select');
    setCueElementDefaultStyle(this, {
      display: CueDisplay.block, position: CuePosition.relative,
      width: 240, minHeight: 40, paddingLeft: 12, paddingRight: 32, paddingTop: 8, paddingBottom: 8,
      backgroundColor: { red: 35, green: 48, blue: 68, alpha: 1 },
      color: { red: 241, green: 245, blue: 249, alpha: 1 }, fontSize: 16,
      borderTopLeftRadius: [6, 6], borderTopRightRadius: [6, 6], borderBottomLeftRadius: [6, 6], borderBottomRightRadius: [6, 6],
    });
    this.#label.insertBefore(this.#labelText);
    this.#arrow.insertBefore(new Text('▾'));
    this.insertBefore(this.#label);
    this.insertBefore(this.#arrow);
    cueTopLayerElements.add(this.#popup);
    this.#popup.insertBefore(this.#list);
  }

  override get acceptsAuthorChildren(): boolean {
    return false;
  }

  get options(): readonly CueSelectOption[] {
    return this.#options;
  }

  set options(value: readonly CueSelectOption[]) {
    this.setProperty('options', value);
  }

  get value(): string | undefined {
    return this.#value;
  }

  set value(value: string | undefined) {
    this.setProperty('value', value);
  }

  get open(): boolean {
    return this.#open;
  }

  set open(value: boolean) {
    this.#setOpen(value);
  }

  protected override propertyChanged(name: string, previous: unknown, next: unknown): void {
    super.propertyChanged(name, previous, next);
    if (name === 'options') {
      if (next !== undefined && !Array.isArray(next)) {
        throw new TypeError('options must be an array.');
      }
      const options = (next ?? []) as readonly CueSelectOption[];
      const values = new Set<string>();
      for (const option of options) {
        if (typeof option.value !== 'string' || typeof option.label !== 'string' || values.has(option.value)) {
          throw new TypeError('Options require unique string values and string labels.');
        }
        values.add(option.value);
      }
      this.#options = options.map((option) => ({ ...option }));
    }
    if (name === 'value') {
      if (next !== undefined && next !== null && typeof next !== 'string') {
        throw new TypeError('Select value must be a string or undefined.');
      }
      this.#value = next ?? undefined;
    }
    if (name === 'disabled' && this.disabled) {
      this.#setOpen(false);
    }
    this.#labelText.data = this.options.find((option) => option.value === this.value)?.label ?? 'Select…';
    if (this.open && (name === 'value' || name === 'options')) {
      this.#candidate = this.#initialCandidate();
      this.#ensureCandidateVisible();
      this.#paintOptions();
    }
  }

  protected override defaultAction(event: CueEvent): void {
    super.defaultAction(event);
    if (event.type === 'blur') {
      this.#setOpen(false);
    }
    if (this.disabled) {
      return;
    }
    if (event.type === 'click') {
      let target = event.target;
      while (target && target !== this) {
        const index = this.#rows.get(target);
        if (index !== undefined) {
          this.#choose(index);
          return;
        }
        target = target.parent;
      }
      this.#setOpen(!this.open);
    }
    if (event instanceof CueWheelEvent && this.open) {
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? this.#viewportHeight : 1;
      this.#scroll = Math.min(Math.max(0, this.#contentHeight - this.#viewportHeight), Math.max(0, this.#scroll + event.deltaY * unit));
      this.#list.style.top = -this.#scroll;
      event.preventDefault();
    }
    if (!(event instanceof CueKeyboardEvent) || event.type !== 'keydown' || event.isComposing) {
      return;
    }
    if (event.key === 'Escape' && this.open) {
      this.#setOpen(false);
      event.preventDefault();
    }
    if (event.key === 'Enter' || event.key === ' ') {
      if (!event.repeat) {
        if (this.open) {
          this.#choose(this.#candidate);
        } else {
          this.#setOpen(true);
        }
      }
      event.preventDefault();
    }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      if (!this.open) {
        this.#setOpen(true);
      }
      const backward = event.key === 'ArrowUp' || event.key === 'End';
      let index = event.key === 'Home' ? -1 : event.key === 'End' ? this.options.length : this.#candidate;
      while (true) {
        const next = index + (backward ? -1 : 1);
        if (next < 0 || next >= this.options.length) {
          break;
        }
        index = next;
        if (!this.options[index]!.disabled) {
          this.#candidate = index;
          break;
        }
      }
      this.#ensureCandidateVisible();
      this.#paintOptions();
      event.preventDefault();
    }
  }

  protected override disconnected(): void {
    this.#setOpen(false);
    super.disconnected();
  }

  #options: readonly CueSelectOption[] = [];
  #value: string | undefined;
  #open = false;
  #candidate = -1;
  #scroll = 0;
  #contentHeight = 0;
  #viewportHeight = 0;
  #revealCandidate = false;
  readonly #rows = new Map<CueElement, number>();
  readonly #labelText = new Text('Select…');
  readonly #label = createControlPart('cue-select-label', { whiteSpace: CueWhiteSpace.nowrap });
  readonly #arrow = createControlPart('cue-select-arrow', { position: CuePosition.absolute, right: 10, top: 8 });
  readonly #popup = createControlPart('cue-select-popup', {
    position: CuePosition.absolute, top: '100%', left: 0, right: 0, zIndex: 1000,
    boxSizing: CueBoxSizing.borderBox, maxHeight: 280,
    overflowX: CueOverflow.hidden, overflowY: CueOverflow.hidden, pointerEvents: CuePointerEvents.auto,
    backgroundColor: { red: 22, green: 33, blue: 50, alpha: 1 },
  });

  readonly #list = createControlPart('cue-select-options', {
    position: CuePosition.relative, display: CueDisplay.flex, flexDirection: CueFlexDirection.column,
    pointerEvents: CuePointerEvents.auto,
  });

  #initialCandidate(): number {
    const index = this.options.findIndex((option) => option.value === this.value && !option.disabled);
    return index >= 0 ? index : this.options.findIndex((option) => !option.disabled);
  }

  #setOpen(open: boolean): void {
    if (open === this.open || (open && this.disabled)) {
      return;
    }
    this.#open = open;
    if (open) {
      this.#candidate = this.#initialCandidate();
      this.#ensureCandidateVisible();
      this.#paintOptions();
      this.insertBefore(this.#popup);
    } else if (this.#popup.parent) {
      this.removeChild(this.#popup);
    }
  }

  #choose(index: number): void {
    const option = this.options[index];
    if (!option || option.disabled) {
      return;
    }
    const previous = this.value;
    this.value = option.value;
    this.#setOpen(false);
    if (previous !== this.value) {
      this.dispatchEvent(new CueInputEvent(this.value));
      this.dispatchEvent(new CueChangeEvent(this.value));
    }
  }

  #ensureCandidateVisible(): void {
    this.#revealCandidate = true;
  }

  #paintOptions(): void {
    this.#list.clearChildren();
    this.#rows.clear();
    for (const [index, option] of this.options.entries()) {
      const row = createControlPart('cue-select-option', {
        boxSizing: CueBoxSizing.borderBox, height: 36, flexShrink: 0, paddingLeft: 12, paddingTop: 7, pointerEvents: CuePointerEvents.auto,
        backgroundColor: index === this.#candidate ? { red: 38, green: 86, blue: 137, alpha: 1 } : { red: 22, green: 33, blue: 50, alpha: 1 },
        color: option.disabled ? { red: 100, green: 116, blue: 139, alpha: 1 } : { red: 241, green: 245, blue: 249, alpha: 1 },
      });
      setCueElementState(row, 'checked', option.value === this.value);
      setCueElementState(row, 'disabled', !!option.disabled);
      row.insertBefore(new Text(option.label));
      this.#rows.set(row, index);
      this.#list.insertBefore(row);
    }
  }

  static {
    updateCueSelectLayout = (element, viewportHeight, regions) => {
      if (!element.open) {
        return false;
      }
      const list = regions.find((region) => region.element === element.#list);
      const popup = regions.find((region) => region.element === element.#popup);
      const host = regions.find((region) => region.element === element);
      if (!list || !popup || !host) {
        return false;
      }
      const above = host.y + host.borderTop;
      const below = viewportHeight - above - element.clientHeight;
      const contentBox = getCueElementContentBox(element.#popup);
      const chrome = popup.height - contentBox.height;
      const desired = list.height + chrome;
      const upward = below < desired && above > below;
      const sideSpace = Math.max(0, upward ? above : below);
      const overlapHost = sideSpace <= chrome;
      if (overlapHost && viewportHeight <= chrome) {
        element.#setOpen(false);
        return true;
      }
      // Padding/borders cannot be compressed to zero by CSS height. If neither
      // side can contain them, use the viewport and allow overlap with the host.
      const height = Math.max(0, Math.min(desired, overlapHost ? viewportHeight : sideSpace));
      element.#contentHeight = list.height;
      element.#viewportHeight = Math.max(0, Math.min(height - chrome, contentBox.height));
      let scroll = element.#scroll;
      if (element.#revealCandidate) {
        const row = regions.find((region) => element.#rows.get(region.element) === element.#candidate);
        if (row) {
          const rowTop = row.y - list.y;
          scroll = Math.max(0, Math.min(scroll, rowTop));
          scroll = Math.max(scroll, rowTop + row.height - element.#viewportHeight);
          element.#revealCandidate = false;
        }
      }
      scroll = Math.min(Math.max(0, scroll), Math.max(0, list.height - element.#viewportHeight));
      const top = overlapHost
        ? Math.max(-above, Math.min(upward ? -height : element.clientHeight, element.clientHeight + below - height))
        : upward ? CueDimensionKeyword.auto : element.clientHeight;
      const bottom = !overlapHost && upward ? element.clientHeight : CueDimensionKeyword.auto;
      const changed = element.#popup.style.top !== top || element.#popup.style.bottom !== bottom
        || element.#popup.style.height !== height || element.#scroll !== scroll;
      element.#popup.style.top = top;
      element.#popup.style.bottom = bottom;
      element.#popup.style.height = height;
      element.#scroll = scroll;
      element.#list.style.top = -scroll;
      return changed;
    };
  }
}

export {};
