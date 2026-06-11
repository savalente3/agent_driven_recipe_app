import { Component, computed, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { AIagentService } from '../../service/agent.service';
import { Recipe, MealPlan } from '../../models/recipe.model';
import { RecipeComponent } from '../recipe/recipe';
import { MealPlanComponent } from '../meal-plan/meal-plan';
import { slideInUp, fadeScale } from './animations';
import { KEYWORDS, DIETARY_OPTIONS, KEYWORD_COLORS } from './constants';

@Component({
  selector: 'app-home',
  imports: [RecipeComponent, MealPlanComponent],
  templateUrl: './home.html',
  styleUrl: './home.scss',
  animations: [slideInUp, fadeScale],
})
export class Home {

  @ViewChild('searchInput') private searchInputRef!: ElementRef<HTMLDivElement>;
  private agentService = inject(AIagentService);
  private smartSearchTimeout: any;

  searchText = signal('');
  location   = signal('Nottingham');
  imageBase64 = signal<string | null>(null);
  showDropdown = signal(false);
  activeKeyword = signal('');
  dropdownX = signal(0);
  dropdownY = signal(0);
  activeView = signal<'initial' | 'recipe' | 'mealplan'>('initial');
  submitted  = signal(false);
  isLoading  = signal(false);

  reqDateRange = signal('');
  reqPeople    = signal('');
  reqDietary   = signal('');

  showDietaryMenu  = signal(false);
  dietaryDropdownX = signal(0);
  dietaryDropdownY = signal(0);
  readonly dietaryOptions = DIETARY_OPTIONS;

  activeModule = computed(() => {
    const text = this.searchText().toLowerCase();
    
    if (text.includes('meal plan') || this.activeView() === 'mealplan') return 'mealplan';
    if (text.includes('recipe')    || this.activeView() === 'recipe')    return 'recipe';
    
    return null;
  });

  recipeData = computed(() => {
    const r = this.agentService.result();
    return r?.module === 'recipe' ? (r.data as Recipe) : null;
  });

  mealPlanData = computed(() => {
    const r = this.agentService.result();
    return r?.module === 'meal-plan' ? (r.data as MealPlan) : null;
  });

  dropdownOptions = computed(() =>
    KEYWORDS.filter(kw => kw !== this.activeKeyword())
  );

  readonly keywordColors = KEYWORD_COLORS;

  private getCursorOffset(el: HTMLElement): number {
    
    const sel = window.getSelection();

    if (!sel || sel.rangeCount === 0) return 0;

    const range = sel.getRangeAt(0);
    const pre = range.cloneRange();

    pre.selectNodeContents(el);
    pre.setEnd(range.startContainer, range.startOffset);
    
    return pre.toString().length;
  }

  private setCursorOffset(el: HTMLElement, offset: number) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    
    let pos = 0;
    let node: Node | null;
    
    while ((node = walker.nextNode())) {
      const len = (node as Text).length;

      if (pos + len >= offset) {
        const range = document.createRange();
        range.setStart(node, offset - pos);
        range.collapse(true);

        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);

        return;
      }
      pos += len;
    }

    const range = document.createRange();

    range.selectNodeContents(el);
    range.collapse(false);

    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
  }


  private renderContent(el: HTMLElement, text: string, cursorOffset?: number) {
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    KEYWORDS.forEach(kw => {
      html = html.replace(new RegExp(kw, 'gi'), `<mark class="keyword">${kw}</mark>`);
    });

    el.innerHTML = html;

    if (cursorOffset !== undefined) {
      this.setCursorOffset(el, Math.min(cursorOffset, text.length));
    }
  }

  onSearchChange(event: Event) {
    const div = event.target as HTMLDivElement;

    // Record cursor BEFORE touching the DOM
    const cursorOffset = this.getCursorOffset(div);

    // Get clean text — textContent from contenteditable, strip any stray ▾
    let text = (div.textContent ?? '').replace(/▾/g, '');

    // Normalise keyword casing
    KEYWORDS.forEach(kw => {
      text = text.replace(new RegExp(`(${kw})`, 'gi'), kw);
    });

    // Re-render with keyword marks and restore cursor
    this.renderContent(div, text, cursorOffset);
    this.searchText.set(text);

    if (!text.trim()) {
      this.activeView.set('initial');
      this.submitted.set(false);
      this.showDropdown.set(false);
      return;
    }

    // Smart search — debounced, only fires when text is meaningful
    clearTimeout(this.smartSearchTimeout);
    this.smartSearchTimeout = setTimeout(() => this.runSmartSearch(text), 400);
  }

  private stripLeadingKeyword(text: string): string {
    for (const kw of KEYWORDS) {
      const re = new RegExp(`^${kw}\\s+`, 'i');
      if (re.test(text)) return text.replace(re, '');
    }
    return text;
  }

  private async runSmartSearch(text: string) {
    if (text.trim().length < 10) return;

    // Strip any auto-injected keyword prefix before asking the agent —
    // otherwise it just sees its own previous suggestion echoed back and
    // never changes its mind.
    const core = this.stripLeadingKeyword(text);

    const result = await this.agentService.smartSearch(core);
    if (!result) return;

    // Use current text from signal (user may have typed more while waiting)
    const currentText = this.searchText();
    const currentCore = this.stripLeadingKeyword(currentText);

    if (result.intent) {
      const keyword = result.intent === 'recipe' ? 'Recipe' : 'Meal plan';

      // If the user's own sentence already contains a keyword phrase,
      // that occurrence becomes the highlighted/clickable keyword — drop
      // the auto-injected prefix instead of duplicating it.
      const hasEmbeddedKeyword = KEYWORDS.some(kw => currentCore.toLowerCase().includes(kw.toLowerCase()));

      let updated = hasEmbeddedKeyword ? currentCore : `${keyword} ${currentCore}`;

      // Normalise keyword casing so the highlighted mark and the stored text agree
      KEYWORDS.forEach(kw => {
        updated = updated.replace(new RegExp(`(${kw})`, 'gi'), kw);
      });

      if (updated.toLowerCase() !== currentText.toLowerCase()) {
        this.searchText.set(updated);

        // Use setTimeout to ensure DOM update happens in Angular's next tick
        setTimeout(() => {
          const div = this.searchInputRef?.nativeElement;
          if (div) this.renderContent(div, updated, updated.length);
        });
      }
    }

    // Auto-populate requirement bubbles
    if (result.people)          this.reqPeople.set(String(result.people));
    if (result.dateRange)       this.reqDateRange.set(result.dateRange);
    if (result.dietary?.length) this.reqDietary.set(result.dietary[0]);
  }

  onInputClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const mark = target.closest('mark.keyword') as HTMLElement | null;

    if (!mark) {
      this.showDropdown.set(false);
      return;
    }

    const kw = KEYWORDS.find(k => k.toLowerCase() === (mark.textContent ?? '').toLowerCase());
    if (!kw) return;

    this.activeKeyword.set(kw);
    this.showDropdown.set(true);

    const markRect = mark.getBoundingClientRect();

    this.dropdownX.set(markRect.left);
    this.dropdownY.set(markRect.bottom + 10);
  }

  selectOption(option: string) {
    
    const updated = this.searchText().replace(
      new RegExp(this.activeKeyword(), 'gi'),
      option
    );

    const cursorOffset = updated.indexOf(option) + option.length;

    this.showDropdown.set(false);
    this.searchText.set(updated);

    const div = this.searchInputRef?.nativeElement;
    
    if (div) {
      this.renderContent(div, updated, cursorOffset);
      div.focus();
    }
  }

  onImageUpload(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => this.imageBase64.set(reader.result as string);
    reader.readAsDataURL(file);
  }

  onPaste(event: ClipboardEvent) {
    event.preventDefault();
    const text = event.clipboardData?.getData('text/plain') ?? '';
    document.execCommand('insertText', false, text);
  }

  openDietaryDropdown(chip: HTMLElement) {
    const rect = chip.getBoundingClientRect();
    this.dietaryDropdownX.set(rect.left);
    this.dietaryDropdownY.set(rect.bottom + 6);
    this.showDietaryMenu.set(true);
  }

  selectDietary(option: string) {
    this.reqDietary.set(option);
    this.showDietaryMenu.set(false);
  }

  resetToInitial() {
    
    this.activeView.set('initial');
    this.showDropdown.set(false);
    this.showDietaryMenu.set(false);
    
    if (!this.agentService.result()) {
      this.submitted.set(false);
    }
  }

  async onSubmit() {

    this.showDropdown.set(false);
    this.showDietaryMenu.set(false);
    this.submitted.set(true);
    this.isLoading.set(true);

    const text = this.searchText();

    if (/meal plan/i.test(text)) { 
      this.activeView.set('mealplan') ;
    } else { 
      this.activeView.set('recipe');
    }

    try {
      await this.agentService.runAgent(text, this.location(), this.imageBase64() ?? undefined, 'gpt-4o');
    } finally {
      this.isLoading.set(false);
    }

    const result = this.agentService.result();
    if (result?.module === 'recipe') {
      this.activeView.set('recipe')

    } else if (result?.module === 'meal-plan') {

      this.activeView.set('mealplan');
      const params = (result.data as MealPlan)?.parameters;
      
      if (params) {
        if (params.dateRange) this.reqDateRange.set(params.dateRange);
        if (params.people)    this.reqPeople.set(String(params.people));
        if (params.allergies?.length) this.reqDietary.set(params.allergies.join(', '));
      }

    }
  }
}
