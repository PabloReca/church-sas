<script lang="ts">
  let {
    value = $bindable(""),
    placeholder = "",
    name = "",
    id = "",
    required = false,
    disabled = false,
    capitalize = false,
    error = "",
  }: {
    value?: string;
    placeholder?: string;
    name: string;
    id?: string;
    required?: boolean;
    disabled?: boolean;
    capitalize?: boolean;
    error?: string;
  } = $props();

  let inputId = $derived(id || `input-${Math.random().toString(36).substring(2, 11)}`);
  let focused = $state(false);
  let isFloating = $derived(focused || value.length > 0);

  const capitalizeWords = (str: string): string => {
    return str.replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
    }
  };

  const handleInput = (e: Event) => {
    const target = e.target as HTMLTextAreaElement;
    let newValue = target.value.replace(/\r?\n/g, '');
    if (capitalize) {
      newValue = capitalizeWords(newValue);
    }
    value = newValue;
  };

  $effect(() => {
    const handleTouch = (e: TouchEvent) => {
      const textarea = document.getElementById(inputId);
      if (textarea && e.target && !textarea.contains(e.target as Node)) {
        textarea.blur();
      }
    };

    document.addEventListener('touchstart', handleTouch);
    return () => document.removeEventListener('touchstart', handleTouch);
  });
</script>

<div class="relative w-full">
  <textarea
    id={inputId}
    {name}
    {required}
    {disabled}
    bind:value
    onfocus={() => focused = true}
    onblur={() => {
      focused = false;
      value = value.trim();
    }}
    onkeydown={handleKeyDown}
    oninput={handleInput}
    ontouchend={(e) => { e.preventDefault(); (e.target as HTMLTextAreaElement)?.focus(); }}
    autocomplete="off"
    rows="1"
    class="h-12 w-full px-3 py-3 text-base border rounded-md bg-transparent transition-colors focus:outline-none focus:ring-0.5 text-white resize-none overflow-hidden {error ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-600 focus:ring-white focus:border-white'}"
  ></textarea>

  <label
    for={inputId}
    class="absolute left-3 pointer-events-none transition-all duration-200 ease-in-out {isFloating
      ? 'text-xs -top-2 bg-custom-dark px-1'
      : 'top-3 text-base'} {error ? 'text-red-500' : isFloating ? 'text-white' : 'text-gray-400'}"
  >
    {placeholder}
  </label>

  {#if error}
    <p class="mt-1 text-xs text-red-500">{error}</p>
  {/if}
</div>
