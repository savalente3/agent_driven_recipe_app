import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
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
  @Input() loadingStatus = '';

  @Output() activate = new EventEmitter<void>();
  @Output() regenerate = new EventEmitter<void>();

  failedImages = signal<Set<string>>(new Set());

  hasImage(recipe: Recipe | null): boolean {
    return !!recipe?.imageUrl && !this.failedImages().has(recipe.imageUrl);
  }

  onImageError(url?: string | null) {
    if (!url) return;
    this.failedImages.update(set => new Set(set).add(url));
  }
}
