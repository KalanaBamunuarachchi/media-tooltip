
import type { TooltipInstance, TooltipOptions } from "./types";

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
    let hideTimeout: ReturnType<typeof setTimeout> | undefined;
    let destroyed = false;

    video.src = options.media;
    video.autoplay = options.autoplay ?? true;
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

        container.style.display = "block";
        positionTooltip();

        if (options.autoplay ?? true) {
            if (video.ended) {
                video.currentTime = 0;
            }

            video.play().catch(() => { });
        }
    }

    function hide(): void {
        clearTimeout(hideTimeout);

        container.style.display = "none";
        video.pause();
    }

    function destroy(): void {
        if (destroyed) return;

        destroyed = true;
        cancelHide();

        if ((options.trigger ?? "hover") === "hover") {
            element.removeEventListener("mouseenter", handleMouseEnter);
            element.removeEventListener("mouseleave", handleMouseLeave);

            container.removeEventListener("mouseenter", cancelHide);
            container.removeEventListener("mouseleave", handleMouseLeave);
        }
        if (options.trigger === "click") {
            element.removeEventListener("click", handleClick);
            document.removeEventListener("click", handleDocumentClick);
        }

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

    function handleClick(): void {
        if (destroyed) return;

        if (container.style.display === "none") {
            show();
        } else {
            hide();
        }
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

    if ((options.trigger ?? "hover") === "hover") {
        element.addEventListener("mouseenter", handleMouseEnter);
        element.addEventListener("mouseleave", handleMouseLeave);

        container.addEventListener("mouseenter", cancelHide);
        container.addEventListener("mouseleave", handleMouseLeave);
    }

    if (options.trigger === "click") {
        element.addEventListener("click", handleClick);
        document.addEventListener("click", handleDocumentClick);
    }


    return {
        show,
        hide,
        destroy
    };




}


export function createMediaTooltips() {
    const elements = document.querySelectorAll<HTMLElement>(
        "[data-tooltip-media]"
    );


    const instances = Array.from(elements).map((element) => {
        const media = element.dataset.tooltipMedia;

        if (!media) return null;

        const rawPosition = element.dataset.tooltipPosition;
        const rawWidth = element.dataset.tooltipWidth;
        const parsedWidth = rawWidth === undefined ? undefined : Number(rawWidth);
        const rawOffset = element.dataset.tooltipOffset;
        const parsedOffset = rawOffset === undefined ? undefined : Number(rawOffset);
        const rawTrigger = element.dataset.tooltipTrigger;
        const autoplay = element.dataset.tooltipAutoplay;
        const loop = element.dataset.tooltipLoop;
        const muted = element.dataset.tooltipMuted;

        //position
        const position =
            rawPosition === "top" ||
                rawPosition === "bottom" ||
                rawPosition === "left" ||
                rawPosition === "right"
                ? rawPosition
                : undefined;

        //width
        const width =
            parsedWidth !== undefined &&
                Number.isFinite(parsedWidth) &&
                parsedWidth > 0
                ? parsedWidth
                : undefined;

        const offset =
            parsedOffset !== undefined &&
                Number.isFinite(parsedOffset) &&
                parsedOffset >= 0
                ? parsedOffset
                : undefined;

        const trigger =
            rawTrigger === "hover" || rawTrigger === "click"
                ? rawTrigger
                : undefined;

        const parsedAutoplay =
            autoplay === undefined ? undefined : autoplay === "true";

        const parsedLoop =
            loop === undefined ? undefined : loop === "true";

        const parsedMuted =
            muted === undefined ? undefined : muted === "true";

        return tooltip(element, {
            media,
            position,
            width,
            offset,
            trigger,
            autoplay: parsedAutoplay,
            loop: parsedLoop,
            muted: parsedMuted,
        });
    });

    return {
        destroy() {
            instances.forEach((instance) => instance?.destroy());
        }
    };
}
