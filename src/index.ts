import type { TooltipInstance, TooltipOptions, MediaTooltipsOptions } from "./types";
export type { TooltipPosition, TooltipTrigger, TooltipError, TooltipOptions, TooltipInstance, MediaTooltipsOptions } from "./types";

let tooltipIdCounter = 0;
let activeTooltip: TooltipInstance | null = null;

export function tooltip(
    target: string | HTMLElement,
    options: TooltipOptions
): TooltipInstance {
    const resolvedElement =
        typeof target === "string"
            ? document.querySelector<HTMLElement>(target)
            : target;

    if (!resolvedElement) {
        throw new Error(
            typeof target === "string"
                ? `Tooltip target not found: ${target}`
                : "Tooltip target element is unavailable."
        );
    }

    const element: HTMLElement = resolvedElement;
    let instance!: TooltipInstance;

    const container = document.createElement("div");
    const video = document.createElement("video");

    const tooltipId = `media-tooltip-${++tooltipIdCounter}`;

    container.id = tooltipId;
    container.setAttribute("role", "tooltip");
    container.setAttribute("aria-hidden", "true");

    // Connect trigger to tooltip
    const previousDescribedBy = element.getAttribute("aria-describedby");

    const describedByIds = previousDescribedBy
        ? previousDescribedBy.split(/\s+/).filter(Boolean)
        : [];

    if (!describedByIds.includes(tooltipId)) {
        describedByIds.push(tooltipId);
    }

    element.setAttribute("aria-describedby", describedByIds.join(" "));

    if (options.className) {
        container.classList.add(
            ...options.className.split(/\s+/).filter(Boolean)
        );
    }
    let hideTimeout: ReturnType<typeof setTimeout> | undefined;
    let destroyed = false;
    let pointerStart: { x: number; y: number } | null = null;
    let sourceLoaded = false;
    let loadTimeoutId: ReturnType<typeof setTimeout> | undefined;
    let loadTimedOut = false;

    video.preload = "none";
    video.autoplay = false;
    video.loop = options.loop ?? true;
    video.muted = options.muted ?? true;

    container.appendChild(video);

    container.style.position = "fixed";
    container.style.zIndex = "9999";
    container.style.display = "none";
    container.style.overflow = "hidden";

    video.style.display = "block";
    video.style.width = `${options.width ?? 300}px`;
    video.style.height = "auto";
    video.style.maxWidth = "calc(100vw - 16px)";
    video.style.maxHeight = "calc(100vh - 16px)";
    video.style.objectFit = "contain";

    document.body.appendChild(container);

    //postioning helper func

    const positionTooltip = () => {
        const rect = element.getBoundingClientRect();

        const offset = options.offset ?? 8;
        const margin = 8;

        const width = container.offsetWidth;
        const height = container.offsetHeight;

        const preferred = options.position ?? "top";

        const opposite = {
            top: "bottom",
            bottom: "top",
            left: "right",
            right: "left",
        } as const;

        const getCoordinates = (
            position: NonNullable<TooltipOptions["position"]>
        ) => {
            let top: number;
            let left: number;

            switch (position) {
                case "top":
                    top = rect.top - height - offset;
                    left = rect.left + (rect.width - width) / 2;
                    break;

                case "bottom":
                    top = rect.bottom + offset;
                    left = rect.left + (rect.width - width) / 2;
                    break;

                case "left":
                    top = rect.top + (rect.height - height) / 2;
                    left = rect.left - width - offset;
                    break;

                case "right":
                    top = rect.top + (rect.height - height) / 2;
                    left = rect.right + offset;
                    break;
            }

            const fits = {
                top: rect.top - height - offset >= margin,
                bottom: rect.bottom + height + offset <=
                    window.innerHeight - margin,
                left: rect.left - width - offset >= margin,
                right: rect.right + width + offset <=
                    window.innerWidth - margin,
            }[position];

            return { top, left, fits };
        };

        const order = [
            preferred,
            opposite[preferred],
            ...(["top", "bottom", "left", "right"] as const).filter(
                (side) =>
                    side !== preferred && side !== opposite[preferred]
            ),
        ];

        const selected =
            order.map(getCoordinates).find((result) => result.fits) ??
            getCoordinates(preferred);

        const maxLeft = Math.max(
            margin,
            window.innerWidth - width - margin
        );

        const maxTop = Math.max(
            margin,
            window.innerHeight - height - margin
        );

        container.style.left =
            `${Math.min(maxLeft, Math.max(margin, selected.left))}px`;

        container.style.top =
            `${Math.min(maxTop, Math.max(margin, selected.top))}px`;
    };

    function loadVideo(): void {
        if (sourceLoaded || destroyed) return;

        sourceLoaded = true;

        const timeout = options.loadTimeout ?? 0;

        if (Number.isFinite(timeout) && timeout > 0) {
            loadTimeoutId = setTimeout(() => {
                loadTimedOut = true;
                loadTimeoutId = undefined;

                video.pause();

                options.onError?.({
                    type: "media",
                    message: "Video loading timed out.",
                });
            }, timeout);
        }

        video.preload = "auto";
        video.src = options.media;
        video.load();
    }


    function handleVideoMetadata(): void {
        if (destroyed) return;

        if (container.style.display !== "none") {
            positionTooltip();
        }
    }

    function handleVideoCanPlay(): void {
        if (loadTimeoutId !== undefined) {
            clearTimeout(loadTimeoutId);
            loadTimeoutId = undefined;
        }
    }

    function handleVideoError(): void {
        if (destroyed) return;

        const error = video.error;

        if (loadTimeoutId !== undefined) {
            clearTimeout(loadTimeoutId);
            loadTimeoutId = undefined;
        }

        options.onError?.({
            type: "media",
            message: error?.message || "Failed to load video.",
            code: error?.code,
        });
    }

    function handleViewportChange(): void {
        if (destroyed || container.style.display === "none") {
            return;
        }

        positionTooltip();
    }


    video.addEventListener("loadedmetadata", handleVideoMetadata);
    video.addEventListener("error", handleVideoError);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    video.addEventListener("canplay", handleVideoCanPlay);



    function show(): void {
        if (destroyed) return;

        cancelHide();

        if (activeTooltip && activeTooltip !== instance) {
            activeTooltip.hide();
        }

        activeTooltip = instance;

        const wasHidden = container.style.display === "none";

        container.style.display = "block";
        container.setAttribute("aria-hidden", "false");

        loadVideo();

        positionTooltip();

        const prefersReducedMotion =
            window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        const shouldAutoplay =
            options.autoplay ?? !prefersReducedMotion;

        if (shouldAutoplay && !loadTimedOut) {
            if (video.ended) video.currentTime = 0;

            video.play()
                .then(() => {
                    if (
                        destroyed ||
                        loadTimedOut ||
                        container.style.display === "none"
                    ) {
                        video.pause();
                    }
                })
                .catch((cause: unknown) => {
                    if (destroyed || loadTimedOut) return;

                    options.onError?.({
                        type: "playback",
                        message: "Failed to start video playback.",
                        cause,
                    });
                });
            
        }

        if (wasHidden) {
            options.onShow?.();
        }
    }

    function hide(): void {
        if (destroyed) return;

        const wasVisible = container.style.display !== "none";

        cancelHide();

        container.style.display = "none";
        container.setAttribute("aria-hidden", "true");

        if (activeTooltip === instance) {
            activeTooltip = null;
        }

        video.pause();

        if (wasVisible) {
            options.onHide?.();
        }
    }

    function destroy(): void {
        if (destroyed) return;

        destroyed = true;
        cancelHide();

        if (activeTooltip === instance) {
            activeTooltip = null;
        }

        //destroy cleanup
        if (loadTimeoutId !== undefined) {
            clearTimeout(loadTimeoutId);
            loadTimeoutId = undefined;
        }

        // Restore the trigger's original aria-describedby value.
        if (previousDescribedBy === null) {
            element.removeAttribute("aria-describedby");
        } else {
            element.setAttribute("aria-describedby", previousDescribedBy);
        }

        if ((options.trigger ?? "hover") === "hover") {
            element.removeEventListener("mouseenter", handleMouseEnter);
            element.removeEventListener("mouseleave", handleMouseLeave);

            container.removeEventListener("mouseenter", cancelHide);
            container.removeEventListener("mouseleave", handleMouseLeave);

            element.removeEventListener("pointerdown", handlePointerDown);
            element.removeEventListener("pointerup", handlePointerUp);
            element.removeEventListener("pointercancel", handlePointerCancel);

            document.removeEventListener("pointerdown", handleDocumentPointerDown);

            element.removeEventListener("focus", handleFocus);
            element.removeEventListener("blur", handleBlur);
        }

        if (options.trigger === "click") {
            element.removeEventListener("click", handleClick);
            element.removeEventListener("blur", handleBlur);
            document.removeEventListener("click", handleDocumentClick);
        }

        document.removeEventListener("keydown", handleDocumentKeyDown);

        video.pause();
        video.removeAttribute("src");
        video.load();

        container.remove();
        video.removeEventListener("loadedmetadata", handleVideoMetadata);
        video.removeEventListener("error", handleVideoError);
        window.removeEventListener("resize", handleViewportChange);
        window.removeEventListener("scroll", handleViewportChange, true);
        video.removeEventListener("canplay", handleVideoCanPlay);
    }
    //timeout for tooltip

    function cancelHide(): void {
        if (hideTimeout !== undefined) {
            clearTimeout(hideTimeout);
            hideTimeout = undefined;
        }
    }

    function scheduleHide(): void {
        cancelHide();

        hideTimeout = setTimeout(() => {
            hide();
            hideTimeout = undefined;
        }, 150);
    }


    function handleMouseEnter(): void {
        cancelHide();
        show();
    }

    function handleMouseLeave(): void {
        scheduleHide();
    }

    function handleFocus(): void {
        cancelHide();
        show();
    }

    function handleBlur(): void {
        scheduleHide();
    }

    function handleClick(): void {
        if (destroyed) return;

        if (container.style.display === "none") {
            show();
        } else {
            hide();
        }
    }

    function handlePointerDown(event: PointerEvent): void {
        if (event.pointerType !== "touch" && event.pointerType !== "pen") {
            return;
        }

        pointerStart = {
            x: event.clientX,
            y: event.clientY,
        };
    }

    function handlePointerUp(event: PointerEvent): void {
        if (!pointerStart || destroyed) return;

        const deltaX = event.clientX - pointerStart.x;
        const deltaY = event.clientY - pointerStart.y;

        pointerStart = null;

        // Ignore scrolling and other significant pointer movement.
        if (Math.hypot(deltaX, deltaY) > 10) {
            return;
        }

        if (event.pointerType !== "touch" && event.pointerType !== "pen") {
            return;
        }

        if (container.style.display === "none") {
            show();
        } else {
            hide();
        }
    }

    function handlePointerCancel(): void {
        pointerStart = null;
    }

    function handleDocumentPointerDown(event: PointerEvent): void {
        if (destroyed || container.style.display === "none") {
            return;
        }

        const target = event.target;

        if (
            target instanceof Node &&
            (element.contains(target) || container.contains(target))
        ) {
            return;
        }

        hide();
    }

    function handleDocumentClick(event: MouseEvent): void {
        const target = event.target;

        if (
            target instanceof Node &&
            (element.contains(target) || container.contains(target))
        ) {
            return;
        }

        hide();
    }

    function handleDocumentKeyDown(event: KeyboardEvent): void {
        if (destroyed || event.key !== "Escape") return;

        if (container.style.display !== "none") {
            hide();
        }
    }

    if ((options.trigger ?? "hover") === "hover") {
        element.addEventListener("mouseenter", handleMouseEnter);
        element.addEventListener("mouseleave", handleMouseLeave);

        container.addEventListener("mouseenter", cancelHide);
        container.addEventListener("mouseleave", handleMouseLeave);

        // Touch and pen interactions
        element.addEventListener("pointerdown", handlePointerDown);
        element.addEventListener("pointerup", handlePointerUp);
        element.addEventListener("pointercancel", handlePointerCancel);

        //accessibility
        element.addEventListener("focus", handleFocus);
        element.addEventListener("blur", handleBlur);

        document.addEventListener("pointerdown", handleDocumentPointerDown);
    }

    if (options.trigger === "click") {
        element.addEventListener("click", handleClick);
        element.addEventListener("blur", handleBlur);
        document.addEventListener("click", handleDocumentClick);
    }

    document.addEventListener("keydown", handleDocumentKeyDown);


    instance = {
        show,
        hide,
        destroy
    };

    return instance;




}

function getBooleanOption(
    value: string | undefined,
    defaultValue: boolean | undefined
): boolean | undefined {
    if (value === "true") return true;
    if (value === "false") return false;

    return defaultValue;
}


export function createMediaTooltips(options: MediaTooltipsOptions = {}) {
    const selector = options.selector ?? "[data-tooltip-media]";
    const instances = new Map<HTMLElement, TooltipInstance>();

    //helper
    function getPosition(element: HTMLElement): TooltipOptions["position"] {
        const value = element.dataset.tooltipPosition;

        if (
            value === "top" ||
            value === "bottom" ||
            value === "left" ||
            value === "right"
        ) {
            return value;
        }

        return options.defaults?.position;
    }

    function getWidth(element: HTMLElement): number | undefined {
        const value = element.dataset.tooltipWidth;

        if (value === undefined) return options.defaults?.width;

        const parsed = Number(value);

        return Number.isFinite(parsed) && parsed > 0
            ? parsed
            : options.defaults?.width;
    }

    function getOffset(element: HTMLElement): number | undefined {
        const value = element.dataset.tooltipOffset;

        if (value === undefined) return options.defaults?.offset;

        const parsed = Number(value);

        return Number.isFinite(parsed) && parsed >= 0
            ? parsed
            : options.defaults?.offset;
    }

    function getTrigger(element: HTMLElement): TooltipOptions["trigger"] {
        const value = element.dataset.tooltipTrigger;

        return value === "hover" || value === "click"
            ? value
            : options.defaults?.trigger;
    }


    function initializeElement(element: HTMLElement): void {
        if (instances.has(element)) return;

        const media = element.dataset.tooltipMedia;
        if (!media) return;

        const instance = tooltip(element, {
            media,
            position: getPosition(element),
            width: getWidth(element),
            offset: getOffset(element),
            trigger: getTrigger(element),
            autoplay: getBooleanOption(
                element.dataset.tooltipAutoplay,
                options.defaults?.autoplay
            ),
            loop: getBooleanOption(
                element.dataset.tooltipLoop,
                options.defaults?.loop
            ),
            muted: getBooleanOption(
                element.dataset.tooltipMuted,
                options.defaults?.muted
            ),
            className:
                element.dataset.tooltipClass || options.defaults?.className,
            loadTimeout: options.defaults?.loadTimeout,
            onShow: options.defaults?.onShow,
            onHide: options.defaults?.onHide,
            onError: options.defaults?.onError,
        });

        instances.set(element, instance);
    }

    function initializeMatchingElements(root: ParentNode) {
        if (root instanceof HTMLElement && root.matches(selector)) {
            initializeElement(root);
        }

        root.querySelectorAll<HTMLElement>(selector).forEach(initializeElement);
    }

    // Initialize elements already present in the document.
    initializeMatchingElements(document);

    // Observe future DOM changes.
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            mutation.addedNodes.forEach((node) => {
                if (node instanceof HTMLElement) {
                    initializeMatchingElements(node);
                }
            });

            mutation.removedNodes.forEach((node) => {
                if (!(node instanceof HTMLElement)) return;

                const removedElements: HTMLElement[] = [];

                if (instances.has(node)) {
                    removedElements.push(node);
                }

                node.querySelectorAll<HTMLElement>(selector).forEach((element) => {
                    if (instances.has(element)) {
                        removedElements.push(element);
                    }
                });

                removedElements.forEach((element) => {
                    // Preserve instances when elements are moved within the document.
                    if (!element.isConnected) {
                        instances.get(element)?.destroy();
                        instances.delete(element);
                    }
                });
            });
        }
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
    });

    return {
        destroy() {
            observer.disconnect();

            instances.forEach((instance) => instance.destroy());
            instances.clear();
        }
    };
}
