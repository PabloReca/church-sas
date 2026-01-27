<script lang="ts">
    let {
        value = "",
        placeholder = "",
        name = "",
        id = "",
        required = false,
        disabled = false,
        maxLength = undefined,
    } = $props<{
        value?: string | null;
        placeholder: string;
        name: string;
        id?: string;
        required?: boolean;
        disabled?: boolean;
        maxLength?: number;
    }>();

    let textareaId = $derived(
        id || `textarea-${Math.random().toString(36).substring(2, 11)}`
    );

    let focused = $state(false);
    let isFloating = $derived(focused || (value?.length ?? 0) > 0);

    $effect(() => {
        const handleTouch = (e: TouchEvent) => {
            const textarea = document.getElementById(textareaId);
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
    id={textareaId}
    {name}
    {required}
    {disabled}
    maxlength={maxLength}
    bind:value
    onfocus={() => focused = true}
    onblur={() => focused = false}
    ontouchstart={(e: TouchEvent) => setTimeout(() => (e.target as HTMLTextAreaElement)?.focus(), 0)}
    class="peer w-full min-h-[15lh] {maxLength === undefined ? 'h-full' : ''} px-3 py-3 text-base border border-gray-600 rounded-md bg-transparent transition-colors focus:outline-none focus:ring-0.5 focus:ring-white focus:border-white resize-none"
  ></textarea>

  <label
    for={textareaId}
    class="absolute left-3 pointer-events-none transition-all duration-200 ease-in-out
           {isFloating
             ? 'text-white text-xs -top-2 bg-custom-dark px-1'
             : 'text-gray-400 top-3 text-base'}"
  >
    {placeholder}
  </label>
</div>