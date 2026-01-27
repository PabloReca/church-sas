<script lang="ts">
    import { getUserInitial } from '@/lib/utils/user';

    type FileChangeEvent = {
        name: string;
        value: File | null;
    };

    type CropData = {
        x: number;
        y: number;
        width: number;
        height: number;
    };

    let {
        name,
        placeholder = "",
        accept = "image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif",
        required = false,
        value = null,
        onchange = undefined,
        previewSrc = undefined,
        userName = "",
        id = "",
    }: {
        name: string;
        placeholder?: string;
        accept?: string;
        required?: boolean;
        value?: File | null;
        onchange?: (event: FileChangeEvent) => void;
        previewSrc?: string;
        userName?: string;
        id?: string;
    } = $props();

    let localPreview = $state<string | null>(null);

    // Usar previewSrc si existe, sino el local (para cuando el usuario sube una nueva foto)
    let filePreview = $derived(localPreview || previewSrc || null);
    let originalImageSrc = $state<string | null>(null);
    let imageLoadError = $state(false);
    let fileInput = $state<HTMLInputElement>();
    let focused = $state(false);
    let selecting = $state(false);
    let showCropModal = $state(false);
    let cropCanvas = $state<HTMLCanvasElement>();
    let cropContainer = $state<HTMLDivElement | null>(null);
    let imageElement = $state<HTMLImageElement | null>(null);
    let isConverting = $state(false);

    let cropData = $state<CropData>({
        x: 0,
        y: 0,
        width: 300,
        height: 300,
    });
    let isDragging = $state(false);
    let isResizing = $state(false);
    let dragStart = $state({ x: 0, y: 0 });
    let resizeHandle = $state<string>("");

    let inputId = $derived(id || `input-${Math.random().toString(36).substring(2, 11)}`);

    // Función para detectar si es HEIC/HEIF
    function needsConversion(file: File): boolean {
        const name = file.name.toLowerCase();
        return name.endsWith('.heic') || name.endsWith('.heif');
    }

    // Función para convertir archivo usando el endpoint
    async function convertToWebP(file: File): Promise<string> {
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/utils/to-webp', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Error converting image: ${response.status}`);
            }

            const blob = await response.blob();
            return URL.createObjectURL(blob);
        } catch (error) {
            console.error('Error converting HEIC/HEIF:', error);
            throw error;
        }
    }

    function getEventCoordinates(event: MouseEvent | TouchEvent) {
        const isTouch = event.type.startsWith('touch');
        const source = isTouch ? (event as TouchEvent).touches[0] || (event as TouchEvent).changedTouches[0] : event as MouseEvent;
        return { x: source.clientX, y: source.clientY };
    }

    async function handleChange(event: Event) {
        const target = event.target as HTMLInputElement;
        const file = target.files?.[0] || null;
        selecting = false;

        if (file) {
            try {
                isConverting = true;
                let imageUrl: string;

                if (needsConversion(file)) {
                    // Convertir HEIC/HEIF usando el endpoint
                    imageUrl = await convertToWebP(file);
                } else {
                    // Usar FileReader para otros formatos
                    imageUrl = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            const result = e.target?.result;
                            if (typeof result === 'string') {
                                resolve(result);
                            } else {
                                reject(new Error('Failed to read file'));
                            }
                        };
                        reader.onerror = () => reject(new Error('Error reading file'));
                        reader.readAsDataURL(file);
                    });
                }

                originalImageSrc = imageUrl;
                showCropModal = true;
                imageLoadError = false;

            } catch (error) {
                console.error('Error processing file:', error);
                // Manejar error - mostrar mensaje al usuario
                localPreview = null;
                originalImageSrc = null;
                imageLoadError = true;
            } finally {
                isConverting = false;
            }
        } else {
            localPreview = null;
            originalImageSrc = null;
            imageLoadError = false;
        }
    }

    function startSelection() {
        if (isConverting) return; // Prevenir selección múltiple durante conversión
        selecting = true;
        fileInput?.click();
        focused = true;
    }

    function handleInteractionStart(event: MouseEvent | TouchEvent, action: string) {
        event.preventDefault();
        event.stopPropagation();

        if (!cropContainer) return;

        const coords = getEventCoordinates(event);
        const rect = cropContainer.getBoundingClientRect();
        dragStart = {
            x: coords.x - rect.left,
            y: coords.y - rect.top,
        };

        if (action === "move") {
            isDragging = true;
        } else {
            isResizing = true;
            resizeHandle = action;
        }
    }

    function handleInteractionMove(event: MouseEvent | TouchEvent) {
        if (!isDragging && !isResizing) return;
        if (!imageElement || !cropContainer) return;

        event.preventDefault();

        const coords = getEventCoordinates(event);
        const rect = cropContainer.getBoundingClientRect();
        const currentX = coords.x - rect.left;
        const currentY = coords.y - rect.top;
        const deltaX = currentX - dragStart.x;
        const deltaY = currentY - dragStart.y;

        if (isDragging) {
            const newX = cropData.x + deltaX;
            const newY = cropData.y + deltaY;

            cropData.x = Math.max(0, Math.min(imageElement.clientWidth - cropData.width, newX));
            cropData.y = Math.max(0, Math.min(imageElement.clientHeight - cropData.height, newY));
        } else if (isResizing) {
            const minSize = 30;
            const handles = {
                se: () => Math.max(deltaX, deltaY),
                sw: () => Math.max(-deltaX, deltaY),
                ne: () => Math.max(deltaX, -deltaY),
                nw: () => Math.max(-deltaX, -deltaY)
            };

            const delta = handles[resizeHandle as keyof typeof handles]?.() || 0;
            const newSize = cropData.width + delta;
            const maxSizeFromX = imageElement.clientWidth - cropData.x;
            const maxSizeFromY = imageElement.clientHeight - cropData.y;
            const maxSize = Math.min(maxSizeFromX, maxSizeFromY);

            const finalSize = Math.max(minSize, Math.min(newSize, maxSize));
            const sizeDiff = finalSize - cropData.width;

            if (['sw', 'nw'].includes(resizeHandle)) {
                cropData.x = Math.max(0, cropData.x - sizeDiff);
            }
            if (['ne', 'nw'].includes(resizeHandle)) {
                cropData.y = Math.max(0, cropData.y - sizeDiff);
            }

            cropData.width = finalSize;
            cropData.height = finalSize;
        }

        dragStart = { x: currentX, y: currentY };
    }

    function handleInteractionEnd(event: MouseEvent | TouchEvent) {
        event.preventDefault();
        isDragging = false;
        isResizing = false;
        resizeHandle = "";
    }

    function onImageLoad() {
        if (!imageElement || !cropContainer) return;

        const imageRect = imageElement.getBoundingClientRect();
        const size = Math.min(imageRect.width, imageRect.height) * 0.5;
        cropData = {
            x: (imageRect.width - size) / 2,
            y: (imageRect.height - size) / 2,
            width: size,
            height: size,
        };
    }

    function cancelCrop() {
        showCropModal = false;
        originalImageSrc = null;
        if (fileInput) fileInput.value = "";
    }

    function confirmCrop() {
        if (!imageElement || !originalImageSrc || !cropCanvas) return;

        const ctx = cropCanvas.getContext("2d");
        if (!ctx) return;

        const scaleX = imageElement.naturalWidth / imageElement.clientWidth;
        const scaleY = imageElement.naturalHeight / imageElement.clientHeight;

        cropCanvas.width = cropData.width * scaleX;
        cropCanvas.height = cropData.height * scaleY;

        ctx.drawImage(
            imageElement,
            cropData.x * scaleX,
            cropData.y * scaleY,
            cropData.width * scaleX,
            cropData.height * scaleY,
            0,
            0,
            cropCanvas.width,
            cropCanvas.height,
        );

        cropCanvas.toBlob((blob) => {
            if (blob) {
                localPreview = URL.createObjectURL(blob);
                imageLoadError = false;
                showCropModal = false;

                const croppedFile = new File([blob], "cropped-image.jpg", { type: "image/jpeg" });
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(croppedFile);
                if (fileInput) fileInput.files = dataTransfer.files;

                onchange?.({ name, value: croppedFile });
            }
        }, "image/jpeg", 0.9);
    }
</script>

<svelte:window
    onmousemove={handleInteractionMove}
    onmouseup={handleInteractionEnd}
    ontouchmove={handleInteractionMove}
    ontouchend={handleInteractionEnd}
/>

<div class="relative w-full flex flex-col items-center">
    <div
        role="button"
        aria-controls={inputId}
        aria-label={`${placeholder} - Haz clic para seleccionar nueva foto`}
        class="relative w-32 h-32 rounded-full border-2 border-gray-600 bg-gray-800 overflow-hidden cursor-pointer transition-all hover:border-gray-500 hover:shadow-lg {isConverting ? 'opacity-50 cursor-wait' : ''}"
        ondragover={(e) => e.preventDefault()}
        ondrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer?.files.length && fileInput && !isConverting) {
                fileInput.files = e.dataTransfer.files;
                handleChange({ target: fileInput } as unknown as Event);
            }
        }}
        onclick={startSelection}
        ontouchend={startSelection}
        onkeydown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !isConverting) {
                e.preventDefault();
                startSelection();
            }
        }}
        onfocus={() => focused = true}
        onblur={() => focused = false}
        tabindex="0"
    >
        {#if isConverting}
            <div class="flex flex-col items-center justify-center h-full text-center text-gray-400 bg-gray-800">
                <svg class="animate-spin w-8 h-8 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span class="text-xs">Procesando...</span>
            </div>
        {:else if !filePreview || imageLoadError}
            <div class="flex items-center justify-center h-full bg-gray-600">
                <span class="text-white text-5xl font-semibold">
                    {getUserInitial(userName, null)}
                </span>
            </div>
        {:else}
            <img
                src={filePreview}
                alt="Foto de perfil"
                class="w-full h-full object-cover"
                crossorigin="anonymous"
                onerror={() => imageLoadError = true}
                onload={() => imageLoadError = false}
            />
            <div class="absolute inset-0 rounded-full flex items-center justify-center group hover:bg-black hover:bg-opacity-30 transition-all">
                <svg class="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            </div>
        {/if}
    </div>

    <div class="mt-3 text-center">
        <p class="text-sm text-gray-400">{placeholder || "Foto de perfil"}</p>
        {#if imageLoadError}
            <p class="text-xs text-red-400 mt-1">Error al procesar la imagen</p>
        {/if}
    </div>

    <input
        id={inputId}
        {name}
        type="file"
        {accept}
        {required}
        onchange={handleChange}
        onfocus={() => focused = true}
        onblur={() => focused = false}
        bind:this={fileInput}
        class="absolute opacity-0 pointer-events-none w-0 h-0"
        tabindex="-1"
        disabled={isConverting}
    />

    <canvas bind:this={cropCanvas} class="hidden"></canvas>
</div>

{#if showCropModal && originalImageSrc}
    <div class="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
        <div class="bg-custom-dark rounded-lg p-6 w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-semibold text-white">Recortar Foto de Perfil</h3>
                <button
                    onclick={cancelCrop}
                    ontouchstart={() => setTimeout(() => cancelCrop(), 0)}
                    class="text-gray-400 hover:text-white transition-colors"
                    aria-label="Cerrar"
                    type="button"
                >
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div class="flex-1 flex items-center justify-center mb-6 overflow-hidden">
                <div bind:this={cropContainer} class="relative inline-block max-w-full crop-container">
                    <img
                        bind:this={imageElement}
                        src={originalImageSrc}
                        alt="Imagen para recortar"
                        class="block object-contain crop-image"
                        onload={onImageLoad}
                        draggable="false"
                    />

                    <div
                        role="button"
                        tabindex="0"
                        aria-label="Área de recorte - Arrastra para mover"
                        class="absolute border-2 border-white shadow-lg cursor-move touch-none"
                        style="left: {cropData.x}px; top: {cropData.y}px; width: {cropData.width}px; height: {cropData.height}px;"
                        onmousedown={(e) => handleInteractionStart(e, "move")}
                        ontouchstart={(e) => handleInteractionStart(e, "move")}
                    >
                        <div class="absolute inset-0 pointer-events-none">
                            <div class="absolute left-1/3 top-0 w-px h-full bg-white bg-opacity-50"></div>
                            <div class="absolute left-2/3 top-0 w-px h-full bg-white bg-opacity-50"></div>
                            <div class="absolute top-1/3 left-0 h-px w-full bg-white bg-opacity-50"></div>
                            <div class="absolute top-2/3 left-0 h-px w-full bg-white bg-opacity-50"></div>
                        </div>

                        <div class="absolute inset-0 pointer-events-none">
                            <div class="w-full h-full rounded-full border-2 border-blue-400 border-dashed opacity-70"></div>
                        </div>

                        {#each [
                            { pos: "-top-3 -left-3", cursor: "cursor-nw-resize", handle: "nw" },
                            { pos: "-top-3 -right-3", cursor: "cursor-ne-resize", handle: "ne" },
                            { pos: "-bottom-3 -left-3", cursor: "cursor-sw-resize", handle: "sw" },
                            { pos: "-bottom-3 -right-3", cursor: "cursor-se-resize", handle: "se" }
                        ] as { pos, cursor, handle }}
                            <div
                                role="button"
                                tabindex="0"
                                aria-label="Redimensionar desde esquina {handle}"
                                class="absolute {pos} w-6 h-6 bg-white border border-gray-300 {cursor} touch-none"
                                onmousedown={(e) => handleInteractionStart(e, handle)}
                                ontouchstart={(e) => handleInteractionStart(e, handle)}
                            ></div>
                        {/each}
                    </div>
                </div>
            </div>

            <div class="flex justify-end gap-3">
                <button
                    onclick={cancelCrop}
                    ontouchstart={() => setTimeout(() => cancelCrop(), 0)}
                    class="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                    type="button"
                >
                    Cancelar
                </button>
                <button
                    onclick={confirmCrop}
                    ontouchstart={() => setTimeout(() => confirmCrop(), 0)}
                    class="px-6 py-2 text-custom-dark bg-white rounded transition-colors"
                    type="button"
                >
                    Usar como foto de perfil
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    .crop-container {
        max-height: 500px;
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
    }

    .crop-image {
        max-width: 100%;
        max-height: 500px;
        width: auto;
        height: auto;
        touch-action: none;
    }

    .touch-none {
        touch-action: none;
    }
</style>
