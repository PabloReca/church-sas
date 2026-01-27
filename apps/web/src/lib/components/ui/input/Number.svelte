<script lang="ts">
  let {
    value = $bindable(null as number | null),
    placeholder = "",
    name = "",
    id = "",
    required = false,
    disabled = false,
    min = undefined,
    max = undefined,
    step = 1,
    decimal = false,
    decimalPlaces = 2,
    onChange = undefined,
  }: {
    value?: number | null;
    placeholder?: string;
    name: string;
    id?: string;
    required?: boolean;
    disabled?: boolean;
    min?: number;
    max?: number;
    step?: number;
    decimal?: boolean;
    decimalPlaces?: number;
    onChange?: (value: number | null) => void;
  } = $props();

  let inputValue = $state(value?.toString() ?? "");
  let inputId = $derived(id || `input-number-${Math.random().toString(36).substring(2, 11)}`);
  let focused = $state(false);
  let isFloating = $derived(focused || inputValue.length > 0);
  let isOutOfRange = $state(false);

  let computedStep = $derived(
    decimal && step === 1 ? parseFloat(`0.${"0".repeat(decimalPlaces - 1)}1`) : step
  );

  $effect(() => {
    inputValue = value?.toString() ?? "";
  });

  $effect(() => {
    const handleTouch = (e: TouchEvent) => {
      const input = document.getElementById(inputId);
      if (input && e.target && !input.contains(e.target as Node)) {
        input.blur();
      }
    };

    document.addEventListener('touchstart', handleTouch);
    return () => document.removeEventListener('touchstart', handleTouch);
  });

  function validateNumber(val: number | null): number | null {
    if (val === null) return null;

    let result = val;
    if (min !== undefined && result < min) result = min;
    if (max !== undefined && result > max) result = max;

    return decimal ? parseFloat(result.toFixed(decimalPlaces)) : result;
  }

  function updateValue(newValue: number | null) {
    const validated = validateNumber(newValue);
    value = validated;
    onChange?.(validated);
    isOutOfRange = false;
  }

  function handleKeyDown(event: KeyboardEvent) {
    const blocked = ["e", "E", "+", ","];

    if (!decimal && event.key === ".") {
      event.preventDefault();
      return;
    }

    if (decimal && event.key === "." && inputValue.includes(".")) {
      event.preventDefault();
      return;
    }

    if (blocked.includes(event.key)) {
      event.preventDefault();
    }
  }

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    inputValue = target.value.replace(/[eE]/g, "");
    target.value = inputValue;

    const numValue = inputValue === "" ? null : parseFloat(inputValue);

    if (numValue !== null) {
      isOutOfRange = (min !== undefined && numValue < min) || (max !== undefined && numValue > max);
      const validated = decimal ? parseFloat(numValue.toFixed(decimalPlaces)) : numValue;
      value = validated;
      onChange?.(validated);
    } else {
      value = null;
      onChange?.(null);
      isOutOfRange = false;
    }
  }

  function handleBlur() {
    focused = false;

    if (inputValue) {
      const numValue = parseFloat(inputValue);
      const validated = validateNumber(numValue);

      if (validated !== numValue) {
        inputValue = validated?.toString() ?? "";
        updateValue(validated);
      }
    }
  }
</script>

<div class="relative w-full">
  <input
    id={inputId}
    type="number"
    {name}
    {required}
    {disabled}
    step={computedStep}
    min={min ?? null}
    max={max ?? null}
    value={inputValue}
    oninput={handleInput}
    onkeydown={handleKeyDown}
    onfocus={() => focused = true}
    onblur={handleBlur}
    ontouchstart={(e: TouchEvent) => setTimeout(() => (e.target as HTMLInputElement)?.focus(), 0)}
    autocomplete="off"
    class="w-full h-12 px-3 py-3 text-base border {isOutOfRange ? 'border-red-500' : 'border-gray-600'} rounded-md bg-transparent transition-colors focus:outline-none focus:ring-0.5 focus:ring-white focus:border-white text-white number-input"
  />

  <label
    for={inputId}
    class="absolute left-3 pointer-events-none transition-all duration-200 ease-in-out text-gray-400 {isFloating
      ? 'text-xs -top-2 bg-custom-dark px-1 text-white'
      : 'top-3 text-base'}"
  >
    {placeholder}
  </label>
</div>

<style>
  .number-input::-webkit-outer-spin-button,
  .number-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  .number-input {
    -moz-appearance: textfield;
    appearance: textfield;
  }
</style>
