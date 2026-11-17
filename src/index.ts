import type { TooltipInstance, TooltipOptions, MediaTooltipsOptions } from "./types";
export type { TooltipPosition, TooltipTrigger, TooltipOptions, TooltipInstance, MediaTooltipsOptions } from "./types";

let tooltipIdCounter = 0;

export function tooltip(
    target: string | HTMLElement,
    options: TooltipOptions
): TooltipInstance {
    const resolvedElement =
        typeof target === "string"
            ? document.querySelector<HTMLElement>(target)
            : target;

    if (!resolvedElement) {
        throw new Error(`Tooltip target not found: ${target}`);
    }

    const element: HTMLElement = resolvedElement;

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

    video.src = options.media;
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
    function handleVideoMetadata(): void {
        if (destroyed) return;

        if (container.style.display !== "none") {
            positionTooltip();
        }
    }

    function handleViewportChange(): void {
        if (destroyed || container.style.display === "none") {
            return;
        }

        positionTooltip();
    }


    video.addEventListener("loadedmetadata", handleVideoMetadata);

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);



    function show(): void {
        if (destroyed) return;

        clearTimeout(hideTimeout);

        const wasHidden = container.style.display === "none";

        container.style.display = "block";
        container.setAttribute("aria-hidden", "false");
        positionTooltip();

        const prefersReducedMotion =
            window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        const shouldAutoplay =
            options.autoplay ?? !prefersReducedMotion;

        if (shouldAutoplay) {
            if (video.ended) video.currentTime = 0;
            video.play().catch(() => { });
        }

        if (wasHidden) {
            options.onShow?.();
        }
    }

    function hide(): void {
        if (destroyed) return;

        const wasVisible = container.style.display !== "none";

        clearTimeout(hideTimeout);

        container.style.display = "none";
        container.setAttribute("aria-hidden", "true");
        video.pause();

        if (wasVisible) {
            options.onHide?.();
        }
    }

    function destroy(): void {
        if (destroyed) return;

        destroyed = true;
        cancelHide();

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

        window.removeEventListener("resize", handleViewportChange);
        window.removeEventListener("scroll", handleViewportChange, true);
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


    return {
        show,
        hide,
        destroy
    };




}



export function createMediaTooltips(options: MediaTooltipsOptions = {}) {
    const selector = options.selector ?? "[data-tooltip-media]";
    const instances = new Map<HTMLElement, TooltipInstance>();

    function initializeElement(element: HTMLElement) {
        // Prevent duplicate initialization.
        if (instances.has(element)) return;

        const media = element.dataset.tooltipMedia;
        if (!media) return;

        // Position
        const rawPosition = element.dataset.tooltipPosition;
        let position = options.defaults?.position;

        if (
            rawPosition === "top" ||
            rawPosition === "bottom" ||
            rawPosition === "left" ||
            rawPosition === "right"
        ) {
            position = rawPosition;
        }

        // Width
        const rawWidth = element.dataset.tooltipWidth;
        const parsedWidth = rawWidth === undefined ? undefined : Number(rawWidth);
        let width = options.defaults?.width;

        if (
            parsedWidth !== undefined &&
            Number.isFinite(parsedWidth) &&
            parsedWidth > 0
        ) {
            width = parsedWidth;
        }

        // Offset
        const rawOffset = element.dataset.tooltipOffset;
        const parsedOffset = rawOffset === undefined ? undefined : Number(rawOffset);
        let offset = options.defaults?.offset;

        if (
            parsedOffset !== undefined &&
            Number.isFinite(parsedOffset) &&
            parsedOffset >= 0
        ) {
            offset = parsedOffset;
        }

        // Trigger
        const rawTrigger = element.dataset.tooltipTrigger;
        let trigger = options.defaults?.trigger;

        if (rawTrigger === "hover" || rawTrigger === "click") {
            trigger = rawTrigger;
        }

        // Autoplay
        const rawAutoplay = element.dataset.tooltipAutoplay;
        let autoplay = options.defaults?.autoplay;

        if (rawAutoplay === "true") {
            autoplay = true;
        } else if (rawAutoplay === "false") {
            autoplay = false;
        }

        // Loop
        const rawLoop = element.dataset.tooltipLoop;
        let loop = options.defaults?.loop;

        if (rawLoop === "true") {
            loop = true;
        } else if (rawLoop === "false") {
            loop = false;
        }

        // Muted
        const rawMuted = element.dataset.tooltipMuted;
        let muted = options.defaults?.muted;

        if (rawMuted === "true") {
            muted = true;
        } else if (rawMuted === "false") {
            muted = false;
        }

        // Custom CSS class
        const rawClassName = element.dataset.tooltipClass;
        const className = rawClassName || options.defaults?.className;

        const instance = tooltip(element, {
            media,
            position,
            width,
            offset,
            trigger,
            autoplay,
            loop,
            muted,
            className,
            onShow: options.defaults?.onShow,
            onHide: options.defaults?.onHide,
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
