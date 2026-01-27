<script lang="ts">
interface Option {
  id: string | number;
  label: string;
  disabled?: boolean;
}

interface Props {
  options: Option[];
  selected?: (string | number)[];
  placeholder?: string;
  minSelections?: number;
  maxSelections?: number;
  disabled?: boolean;
  onSelectionChange?: (selected: (string | number)[]) => void;
}

let {
  options,
  selected = $bindable([]),
  placeholder = "Selecciona opciones...",
  minSelections,
  maxSelections,
  disabled = false,
  onSelectionChange
}: Props = $props();

let isOpen = $state(false);
let searchTerm = $state("");
let containerRef = $state<HTMLDivElement>();
let searchInputRef = $state<HTMLInputElement>();
let focusedIndex = $state(-1);

// ID único para aria-controls
const dropdownId = `multiselector-dropdown-${Math.random().toString(36).substr(2, 9)}`;

// Opciones filtradas y disponibles
let filteredOptions = $derived(
  options
    .filter(opt => !selected.includes(opt.id))
    .filter(opt => !searchTerm || opt.label.toLowerCase().includes(searchTerm.toLowerCase()))
);

// Validaciones
let isMinValid = $derived(!minSelections || selected.length >= minSelections);
let isMaxReached = $derived(maxSelections ? selected.length >= maxSelections : false);

function toggleOption(optionId: string | number, focusInput = true) {
  if (disabled) return;

  const isSelected = selected.includes(optionId);
  
  if (isSelected) {
    if (minSelections && selected.length <= minSelections) return;
    selected = selected.filter(id => id !== optionId);
  } else {
    if (isMaxReached) return;
    selected = [...selected, optionId];
  }

  onSelectionChange?.(selected);
  
  // Solo hacer focus si se especifica
  if (focusInput) {
    searchInputRef?.focus();
  }
}

function openDropdown() {
  if (disabled) return;
  isOpen = true;
  focusedIndex = -1;
  setTimeout(() => searchInputRef?.focus(), 0);
}

function handleInputKeydown(event: KeyboardEvent) {
  if (!isOpen) return;
  
  const visibleOptions = filteredOptions.filter(opt => !opt.disabled);
  
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      focusedIndex = focusedIndex < visibleOptions.length - 1 ? focusedIndex + 1 : 0;
      break;
    case 'ArrowUp':
      event.preventDefault();
      focusedIndex = focusedIndex > 0 ? focusedIndex - 1 : visibleOptions.length - 1;
      break;
    case 'Enter':
      event.preventDefault();
      if (focusedIndex >= 0 && visibleOptions[focusedIndex]) {
        toggleOption(visibleOptions[focusedIndex].id);
      }
      break;
    case 'Escape':
      isOpen = false;
      searchTerm = "";
      focusedIndex = -1;
      break;
    case 'Backspace':
      if (!searchTerm && selected.length > 0) {
        const lastSelected = selected[selected.length - 1];
        if (!minSelections || selected.length > minSelections) {
          toggleOption(lastSelected);
        }
      }
      break;
  }
}

function handleClickOutside(event: MouseEvent) {
  if (containerRef && !containerRef.contains(event.target as Node)) {
    isOpen = false;
    searchTerm = "";
    focusedIndex = -1;
  }
}

$effect(() => {
  if (isOpen) {
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }
});

$effect(() => {
  if (searchTerm && !isOpen) {
    isOpen = true;
  }
  focusedIndex = -1;
});
</script>

<div class="relative w-full" bind:this={containerRef}>
  <!-- Label -->
  {#if placeholder}
    <div class="block text-sm font-medium text-white mb-2">
      {placeholder}
    </div>
  {/if}

  <!-- Input Container -->
  <div
    class="relative w-full rounded-lg border-2 py-2 pl-3 pr-3 shadow-sm focus-within:outline-none transition-colors min-h-[2.5rem] flex flex-wrap items-center gap-1 {disabled 
      ? 'bg-custom-dark-gray text-custom-light-gray border-custom-gray' 
      : !isMinValid 
        ? 'border-red-500 bg-custom-dark-gray text-white'
        : 'border-custom-light-gray bg-custom-dark-gray text-white'}"
  >
    <!-- Selected Chips -->
    {#each selected as selectedId}
      {@const option = options.find(opt => opt.id === selectedId)}
      {#if option}
        <div class="inline-flex items-center gap-1 px-2 py-0.5 bg-custom-gray text-white rounded text-xs border border-custom-light-gray">
          <span class="truncate max-w-20">{option.label}</span>
          {#if !disabled && (!minSelections || selected.length > minSelections)}
            <button
              type="button"
              class="text-custom-light-gray"
              onclick={(e) => {
                e.stopPropagation();
                toggleOption(selectedId, false);
              }}
              aria-label="Quitar {option.label}"
            >
              <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          {/if}
        </div>
      {/if}
    {/each}

    <!-- Search Input -->
    <input
      bind:this={searchInputRef}
      type="text"
      class="flex-1 min-w-0 bg-transparent border-0 outline-none text-white placeholder-custom-light-gray text-sm cursor-pointer py-1"
      placeholder={selected.length === 0 ? "Escribe para buscar..." : ""}
      bind:value={searchTerm}
      onkeydown={handleInputKeydown}
      onclick={openDropdown}
      onfocus={() => {
        if (!isOpen) {
          isOpen = true;
          focusedIndex = -1;
        }
      }}
      role="combobox"
      aria-expanded={isOpen}
      aria-controls={dropdownId}
      aria-label="Buscar opciones"
      {disabled}
    />
  </div>

  <!-- Validation Message -->
  {#if !isMinValid && minSelections}
    <p class="mt-1 text-sm text-red-400">
      Selecciona al menos {minSelections} {minSelections === 1 ? 'opción' : 'opciones'}
    </p>
  {/if}

  <!-- Dropdown -->
  {#if isOpen}
    <div 
      id={dropdownId}
      class="absolute z-10 mt-1 w-full rounded-md shadow-lg border max-h-60 overflow-hidden bg-custom-dark-gray border-custom-gray"
    >
      {#if filteredOptions.length > 0}
        <div class="max-h-40 overflow-y-auto">
          {#each filteredOptions as option (option.id)}
            {@const canSelect = !isMaxReached && !option.disabled}
            {@const isFocused = filteredOptions.filter(opt => !opt.disabled).indexOf(option) === focusedIndex}
            
            <button
              type="button"
              class="relative w-full text-left py-2 px-4 text-sm focus:outline-none transition-colors {!canSelect
                ? 'cursor-not-allowed bg-custom-gray text-custom-light-gray'
                : isFocused
                  ? 'bg-custom-light-gray/10 text-white'
                  : 'text-white'}"
              onclick={() => toggleOption(option.id)}
              disabled={!canSelect}
            >
              <span class="block truncate">{option.label}</span>
            </button>
          {/each}
        </div>
      {:else if searchTerm}
        <div class="py-2 px-4 text-custom-light-gray text-sm">
          No se encontraron opciones
        </div>
      {/if}
    </div>
  {/if}
</div>