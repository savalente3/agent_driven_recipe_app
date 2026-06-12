import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, signal } from '@angular/core';
import { MealPlan, MealPlanDay } from '../../models/recipe.model';
import { DIETARY_OPTIONS } from '../home/constants';

interface DaySlot {
  date: string;
  day: MealPlanDay | null;
  column: number;
  weekend: boolean;
}

interface DisplayBlock {
  label: string;
  slots: DaySlot[];
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

@Component({
  selector: 'app-meal-plan',
  standalone: true,
  imports: [],
  templateUrl: './meal-plan.html',
  styleUrl: './meal-plan.scss'
})
export class MealPlanComponent implements OnChanges {
  @Input() mode: 'tile' | 'mini' | 'expanded' = 'tile';
  @Input() data: MealPlan | null = null;
  @Input() loading: boolean = false;
  @Input() loadingStatus = '';
  @Input() regeneratingDate: string | null = null;

  @Output() activate = new EventEmitter<void>();
  @Output() regenerate = new EventEmitter<void>();
  @Output() regenerateDay = new EventEmitter<MealPlanDay>();

  expandedDay = signal<MealPlanDay | null>(null);
  displayBlocks = signal<DisplayBlock[]>([]);

  expandDay(day: MealPlanDay) {
    this.expandedDay.set(day);
  }

  collapseDay() {
    this.expandedDay.set(null);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['data']) {
      this.displayBlocks.set(this.blocks.map(b => ({ label: b.label, slots: this.padBlock(b) })));

      const current = this.expandedDay();
      if (current) {
        const updated = this.findDayByDate(current.date);
        if (updated) this.expandedDay.set(updated);
      }
    }
  }

  /**
   * Expand a block's real days to cover whole calendar weeks (Mon–Sun).
   * Dates inside the requested range render as real tiles; the surrounding
   * days that round out each calendar week come back as disabled placeholders.
   */
  private padBlock(block: any): DaySlot[] {
    const days: MealPlanDay[] = Array.isArray(block?.days) ? block.days : [];

    const asReal = (d: MealPlanDay): DaySlot => ({
      date: d.date,
      day: d,
      column: this.dayColumn(d.date),
      weekend: this.isWeekend(d.date),
    });

    if (block?.type === 'day' || days.length === 0) {
      return days.map(asReal);
    }

    const parsed = days
      .map(d => ({ d, date: this.parseDate(d.date) }))
      .filter((x): x is { d: MealPlanDay; date: Date } => x.date !== null);

    if (parsed.length === 0) return days.map(asReal);

    const hasYear = /\d{4}/.test(days[0].date);
    const byKey = new Map<string, MealPlanDay>();
    parsed.forEach(p => byKey.set(this.dateKey(p.date), p.d));

    const times = parsed.map(p => p.date.getTime());
    const start = this.startOfWeek(new Date(Math.min(...times)));
    const end = this.endOfWeek(new Date(Math.max(...times)));

    const slots: DaySlot[] = [];
    for (const cur = new Date(start); cur <= end; cur.setDate(cur.getDate() + 1)) {
      const real = byKey.get(this.dateKey(cur));
      const weekday = cur.getDay();
      const column = ((weekday + 6) % 7) + 1; // Mon=1 … Sun=7
      const weekend = weekday === 0 || weekday === 6;

      slots.push(real
        ? asReal(real)
        : { date: this.formatDate(cur, hasYear), day: null, column, weekend });
    }

    return slots;
  }

  private parseDate(label: string): Date | null {
    const m = label.match(/(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{4}))?/);
    if (!m) return null;

    const day = parseInt(m[1], 10);
    const month = MONTHS.indexOf(m[2].toLowerCase());
    if (month < 0) return null;

    const year = m[3] ? parseInt(m[3], 10) : new Date().getFullYear();
    return new Date(year, month, day);
  }

  private formatDate(d: Date, withYear: boolean): string {
    const weekday = d.toLocaleDateString('en-GB', { weekday: 'long' });
    const month = d.toLocaleDateString('en-GB', { month: 'long' });
    return withYear
      ? `${weekday} ${d.getDate()} ${month} ${d.getFullYear()}`
      : `${weekday} ${d.getDate()} ${month}`;
  }

  private startOfWeek(d: Date): Date {
    const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    r.setDate(r.getDate() - ((r.getDay() + 6) % 7)); // back to Monday
    return r;
  }

  private endOfWeek(d: Date): Date {
    const r = this.startOfWeek(d);
    r.setDate(r.getDate() + 6); // forward to Sunday
    return r;
  }

  private dateKey(d: Date): string {
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }

  private findDayByDate(date: string): MealPlanDay | null {
    for (const block of this.blocks) {
      const day = block.days.find((d: MealPlanDay) => d.date === date);
      if (day) return day;
    }
    return null;
  }

  showProduceMenu  = signal(false);
  produceDropdownX = signal(0);
  produceDropdownY = signal(0);

  openProduceMenu(chip: HTMLElement) {
    const rect = chip.getBoundingClientRect();
    this.produceDropdownX.set(rect.left);
    this.produceDropdownY.set(rect.bottom + 6);
    this.showProduceMenu.set(true);
  }

  closeProduceMenu() {
    this.showProduceMenu.set(false);
  }

  get blocks(): any[] {
    return Array.isArray(this.data?.blocks) ? this.data.blocks : [];
  }

  private readonly seasonalRe = /^seasonal\b[^:]*:/i;

  get seasonalProduce(): string[] {
    const other = this.data?.parameters?.other ?? [];
    const match = other.find((o: string) => this.seasonalRe.test(o));

    if (!match) return [];

    return match
      .replace(this.seasonalRe, '')
      .split(',')
      .map((item: string) => item.trim())
      .filter(Boolean);
  }

  get parameterBubbles(): { label: string; type: string }[] {

    const bubbles: { label: string; type: string }[] = [];
    const p = this.data?.parameters;

    if (!p) return [];

    const matchDietary = (item: string) =>
      DIETARY_OPTIONS.find(d => d.toLowerCase() === item.toLowerCase());

    if (p.dateRange) bubbles.push({ label: p.dateRange, type: 'daterange' });
    if (p.people) bubbles.push({ label: `${p.people} people`, type: 'people' });

    (p.allergies ?? []).forEach((a: string) => {
      const known = matchDietary(a);
      bubbles.push({ label: known ?? `No ${a}`, type: 'dietary' });
    });

    (p.cuisine ?? []).forEach((c: string) => {
      const known = matchDietary(c);
      bubbles.push(known ? { label: known, type: 'dietary' } : { label: c, type: 'cuisine' });
    });

    (p.other ?? []).forEach((o: string) => {
      if (this.seasonalRe.test(o) || /weather|location/i.test(o)) return;
      bubbles.push({ label: o, type: 'other' });
    });

    return bubbles;
  }

  isWeekend(date: string): boolean {
    return /^(saturday|sunday)/i.test(date);
  }

  private readonly weekdayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  dayColumn(date: string): number {
    const weekday = date.trim().split(/\s+/)[0]?.toLowerCase();
    const idx = this.weekdayOrder.indexOf(weekday);
    return idx >= 0 ? idx + 1 : 1;
  }

  failedImages = signal<Set<string>>(new Set());

  hasImage(day: MealPlanDay): boolean {
    return !!day.imageUrl && !this.failedImages().has(day.imageUrl);
  }

  onImageError(url?: string | null) {
    if (!url) return;
    this.failedImages.update(set => new Set(set).add(url));
  }
}
