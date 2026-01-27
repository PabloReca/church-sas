<script lang="ts">
    type FileChangeEvent = {
        name: string;
        value: File | null;
    };

    let {
        name,
        placeholder = "",
        accept = "image/*",
        required = false,
        value = $bindable(null as File | null),
        onchange = undefined,
        previewSrc = undefined,
        id = "",
    }: {
        name: string;
        placeholder?: string;
        accept?: string;
        required?: boolean;
        value?: File | null;
        onchange?: (event: FileChangeEvent) => void;
        previewSrc?: string;
        id?: string;
    } = $props();

    let filePreview = $state<string | null>(null);
    let fileInput = $state<HTMLInputElement>();
    let focused = $state(false);
    let selecting = $state(false);

    $effect(() => {
        filePreview = previewSrc || null;
    });

    let inputId = $derived(id || `input-${Math.random().toString(36).substring(2, 11)}`);
    let isFloating = $derived(focused || selecting || filePreview !== null);

    function handleChange(event: Event) {
        const target = event.target as HTMLInputElement;
        const file = target.files?.[0] || null;
        selecting = false;

        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                filePreview = e.target?.result as string;
            };
            reader.readAsDataURL(file);
        } else {
            filePreview = previewSrc || null;
        }

        onchange?.({ name, value: file });
    }

    function startSelection() {
        selecting = true;
        fileInput?.click();
        focused = true;
    }
</script>

<div class="relative w-full">
    <div
        role="button"
        aria-controls={inputId}
        aria-label={`${placeholder} - ${filePreview ? "Imagen ya seleccionada" : "Haz clic para seleccionar"}`}
        class="relative w-full h-[350px] border border-gray-600 rounded-md bg-transparent transition-colors {focused
            ? 'ring-0.5 ring-white border-white'
            : ''}"
        ondragover={(e) => e.preventDefault()}
        ondrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer?.files.length && fileInput) {
                fileInput.files = e.dataTransfer.files;
                handleChange({ target: fileInput } as unknown as Event);
            }
        }}
        onclick={startSelection}
        ontouchend={startSelection}
        onkeydown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                startSelection();
            }
        }}
        onfocus={() => focused = true}
        onblur={() => focused = false}
        tabindex="0"
    >
        {#if !filePreview}
            <div class="flex flex-col items-center justify-center h-full text-center text-gray-400">
                <svg
                    class="w-8 h-8 mb-1"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                </svg>
                <p class="text-sm">
                    Arrastra una imagen o haz clic para seleccionar
                </p>
            </div>
        {:else}
            <div class="flex items-center justify-center h-full py-4">
                <img
                    src={filePreview}
                    alt={`${placeholder} - Vista previa de la imagen seleccionada`}
                    class="h-full rounded hover:opacity-80 transition-opacity"
                />
            </div>
        {/if}
    </div>

    <label
        for={inputId}
        class="absolute left-3 pointer-events-none transition-all duration-200 ease-in-out text-gray-400 {isFloating
            ? 'text-xs -top-2 bg-custom-dark px-1 text-white'
            : 'top-3 text-base'}"
    >
        {placeholder}
    </label>

    <input
        id={inputId}
        {name}
        type="file"
        {accept}
        required={required && !previewSrc}
        onchange={handleChange}
        onfocus={() => focused = true}
        onblur={() => focused = false}
        bind:this={fileInput}
        class="hidden"
        aria-hidden="true"
    />
</div>
