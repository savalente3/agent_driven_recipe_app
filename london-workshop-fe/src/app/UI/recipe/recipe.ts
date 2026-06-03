import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Recipe } from '../../models/recipe.model';

@Component({
  selector: 'app-recipe',
  standalone: true,
  imports: [],
  templateUrl: './recipe.html',
  styleUrl: './recipe.scss'
})
export class RecipeComponent {
  @Input() mode: 'tile' | 'mini' | 'expanded' = 'tile';
  @Input() data: Recipe | null = null;
  @Input() location: string = '';
  @Input() loading: boolean = false;

  @Output() activate = new EventEmitter<void>();
  @Output() regenerate = new EventEmitter<void>();
}
