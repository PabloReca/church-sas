<script lang="ts">
  import { onMount } from "svelte";

  let {
    value = $bindable<string | number | null>(null),
    placeholder = "",
    name = "",
    id = "",
    required = false,
    disabled = false,
    options = [],
    onChange = undefined,
    optionsUrl = "",
    valueKey = "id",
    labelKey = "name",
  }: {
    value?: string | number | null;
    placeholder: string;
    name: string;
    id?: string;
    required?: boolean;
    disabled?: boolean;
    options: Array<{ value: string | number; label: string }>;
    onChange?: (value: string) => void;
    optionsUrl?: string;
    valueKey?: string;
    labelKey?: string;
  } = $props();

  let selectId = $derived(id || `select-${Math.random().toString(36).substring(2, 11)}`);
  let instanceId = $state(Math.random().toString(36).substring(2));
  let isLoading = $state(false);
  let loadError = $state("");
  let internalOptions = $state<Array<{ value: string | number; label: string }>>([]);
  let focused = $state(false);

  $effect(() => {
    internalOptions = options;
  });
  let isOpen = $state(false);
  let focusedOptionIndex = $state(-1);

  let selectedOptionText = $derived(
    value !== null && value !== ""
      ? internalOptions.find(option => option.value.toString() === value!.toString())?.label || ""
      : "",
  );
  let labelUp = $derived((value !== null && value !== "") || focused);

  const SELECT_OPEN_EVENT = "select-dropdown-opened";

  onMount(async () => {
    if (optionsUrl) {
      isLoading = true;
      try {
        const response = await fetch(optionsUrl);
        if (!response.ok) throw new Error(`Error ${response.status}: ${response.statusText}`);

        const data = await response.json() as Record<string, unknown>[];
        internalOptions = data.map((item) => ({
          value: item[valueKey] as string | number,
          label: item[labelKey] as string,
        }));
      } catch (err) {
        loadError = "Error loading options";
      } finally {
        isLoading = false;
      }
    }
  });

  $effect(() => {
    if (options?.length > 0) internalOptions = options;
  });

  function toggleDropdown() {
    if (disabled || isLoading) return;

    const willOpen = !isOpen;
    if (willOpen) {
      document.dispatchEvent(new CustomEvent(SELECT_OPEN_EVENT, { detail: { openedId: instanceId } }));
      focusedOptionIndex = value ? internalOptions.findIndex(opt => opt.value.toString() === value) : 0;

      // Scroll automático en móvil para mostrar el dropdown
      setTimeout(() => {
        const dropdown = document.getElementById(`${selectId}-listbox`);
        if (dropdown && "ontouchstart" in window) {
          dropdown.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
        }
      }, 100);
    } else {
      focusedOptionIndex = -1;
    }

    isOpen = willOpen;
  }

  function selectOption(optionValue: string | number) {
    value = optionValue.toString();
    isOpen = false;
    focused = false;
    focusedOptionIndex = -1;
    onChange?.(optionValue.toString());
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (isOpen && focusedOptionIndex >= 0) {
        selectOption(internalOptions[focusedOptionIndex].value);
      } else {
        toggleDropdown();
      }
    } else if (e.key === "Escape" && isOpen) {
      isOpen = false;
      focusedOptionIndex = -1;
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) {
        toggleDropdown();
      } else {
        focusedOptionIndex = focusedOptionIndex < internalOptions.length - 1 ? focusedOptionIndex + 1 : 0;
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (isOpen) {
        focusedOptionIndex = focusedOptionIndex > 0 ? focusedOptionIndex - 1 : internalOptions.length - 1;
      }
    }
  }

  function handleFocus() {
    focused = true;
    if (!isOpen) {
      isOpen = true;
      focusedOptionIndex = value ? internalOptions.findIndex(opt => opt.value.toString() === value) : 0;
    }
  }

  function handleBlur() {
    setTimeout(() => {
      const activeElement = document.activeElement as HTMLElement;
      const container = document.getElementById(selectId)?.closest('.select-container');

      if (!container?.contains(activeElement)) {
        focused = false;
        isOpen = false;
        focusedOptionIndex = -1;
      }
    }, 0);
  }

  $effect(() => {
    const handleOutside = (e: Event) => {
      if (!isOpen) return;
      const target = e.target as Element;
      const container = document.getElementById(selectId)?.closest(".select-container");
      if (container && !container.contains(target)) {
        isOpen = false;
        focused = false;
        focusedOptionIndex = -1;
      }
    };

    const handleSelectOpened = (e: CustomEvent) => {
      if (e.detail.openedId !== instanceId) {
        isOpen = false;
        focused = false;
        focusedOptionIndex = -1;
      }
    };

    document.addEventListener("click", handleOutside);
    document.addEventListener("touchstart", handleOutside);
    document.addEventListener(SELECT_OPEN_EVENT, handleSelectOpened as EventListener);

    return () => {
      document.removeEventListener("click", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
      document.removeEventListener(SELECT_OPEN_EVENT, handleSelectOpened as EventListener);
    };
  });
</script>

<div class="relative w-full select-container" data-instance-id={instanceId}>
  <div
    id={selectId}
    tabindex="0"
    class="w-full h-12 px-3 py-3 text-base border border-gray-600 rounded-md bg-transparent transition-colors cursor-pointer flex justify-between items-center outline-none {focused
      ? 'ring-0.5 ring-white border-white'
      : ''} {disabled || isLoading
      ? 'opacity-60 cursor-not-allowed'
      : 'text-white'}"
    onclick={toggleDropdown}
    ontouchstart={toggleDropdown}
    onkeydown={handleKeyDown}
    onfocus={handleFocus}
    onblur={handleBlur}
    role="combobox"
    aria-expanded={isOpen}
    aria-controls={`${selectId}-listbox`}
    aria-haspopup="listbox"
  >
    <span class="truncate flex-grow {selectedOptionText ? 'text-white' : 'text-gray-500'}">
      {selectedOptionText}
    </span>

    {#if isLoading}
      <div class="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin shrink-0 ml-2"></div>
    {:else}
      <svg
        class="w-5 h-5 text-gray-400 transition-transform duration-200 shrink-0 ml-2 {isOpen ? 'transform rotate-180' : ''}"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fill-rule="evenodd"
          d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
          clip-rule="evenodd"
        />
      </svg>
    {/if}
  </div>

  <label
    for={selectId}
    class="absolute left-3 pointer-events-none transition-all duration-200 ease-in-out {labelUp
      ? 'text-xs -top-2 bg-custom-dark px-1 text-gray-300'
      : 'text-gray-400 top-3 text-base'}"
  >
    {placeholder}
  </label>

  {#if isOpen && internalOptions.length > 0}
    <div
      class="absolute z-20 w-full mt-1 bg-[#212026] border border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto"
      id={`${selectId}-listbox`}
      role="listbox"
    >
      <ul class="py-1">
        {#each internalOptions as option, index}
          <li
            class="px-3 py-2 cursor-pointer outline-none transition-colors {index === focusedOptionIndex
              ? 'bg-gray-700'
              : value === option.value.toString()
                ? 'bg-gray-800'
                : 'hover:bg-gray-800'}"
            role="option"
            aria-selected={value === option.value.toString()}
            onclick={() => selectOption(option.value)}
            ontouchend={(e) => { e.preventDefault(); selectOption(option.value); }}
            onkeydown={(e) => e.key === "Enter" && selectOption(option.value)}
            tabindex="0"
          >
            {option.label}
          </li>
        {/each}
      </ul>
    </div>
  {/if}

  {#if name}
    <select {name} {required} {disabled} class="sr-only" aria-hidden="true" tabindex="-1">
      <option value="" disabled selected={value === null || value === ""}></option>
      {#each internalOptions as option}
        <option value={option.value} selected={value === option.value.toString()}>{option.label}</option>
      {/each}
    </select>
  {/if}
</div>
