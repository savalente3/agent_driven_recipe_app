import { Component, Input, Output, EventEmitter } from '@angular/core';
import { MealPlan } from '../../models/recipe.model';

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

  get blocks(): any[] {
    return Array.isArray(this.data?.blocks) ? this.data.blocks : [];
  }

  get parameterBubbles(): string[] {

    const bubbles: string[] = [];
    const p = this.data?.parameters;

    if (!p) return [];
    
    if (p.dateRange) bubbles.push(p.dateRange);
    if (p.people) bubbles.push(`${p.people} people`);

    (p.allergies ?? []).forEach((a: string) => bubbles.push(`No ${a}`));
    (p.cuisine ?? []).forEach((c: string) => bubbles.push(c));
    (p.other ?? []).forEach((o: string) => bubbles.push(o));

    return bubbles;
  }
}
