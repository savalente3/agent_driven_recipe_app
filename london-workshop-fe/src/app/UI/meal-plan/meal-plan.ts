import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { MealPlan, MealPlanDay } from '../../models/recipe.model';

@Component({
  selector: 'app-meal-plan',
  standalone: true,
  imports: [],
  templateUrl: './meal-plan.html',
  styleUrl: './meal-plan.scss'
})
export class MealPlanComponent {
  @Input() mode: 'tile' | 'mini' | 'expanded' = 'tile';
  @Input() data: MealPlan | null = null;
  @Input() loading: boolean = false;
  
  @Output() activate = new EventEmitter<void>();
  @Output() regenerate = new EventEmitter<void>();

  expandedDay = signal<MealPlanDay | null>(null);

  expandDay(day: MealPlanDay) {
    this.expandedDay.set(day);
  }

  collapseDay() {
    this.expandedDay.set(null);
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

  get seasonalProduce(): string[] {
    const other = this.data?.parameters?.other ?? [];
    const match = other.find((o: string) => /^seasonal produce\s*:/i.test(o));

    if (!match) return [];

    return match
      .replace(/^seasonal produce\s*:\s*/i, '')
      .split(',')
      .map((item: string) => item.trim())
      .filter(Boolean);
  }

  get parameterBubbles(): string[] {

    const bubbles: string[] = [];
    const p = this.data?.parameters;

    if (!p) return [];

    if (p.dateRange) bubbles.push(p.dateRange);
    if (p.people) bubbles.push(`${p.people} people`);

    (p.allergies ?? []).forEach((a: string) => bubbles.push(`No ${a}`));
    (p.cuisine ?? []).forEach((c: string) => bubbles.push(c));
    (p.other ?? []).forEach((o: string) => {
      if (/^(location|weather|seasonal produce)\s*:/i.test(o)) return;
      bubbles.push(o);
    });

    return bubbles;
  }
}
