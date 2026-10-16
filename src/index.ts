
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
        console.log({
            target: {
                top: rect.top,
                bottom: rect.bottom,
                left: rect.left,
                right: rect.right,
                width: rect.width,
                height: rect.height,
            },
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight,
            },
        });
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
    video.addEventListener("loadedmetadata", positionTooltip);


    function show(): void {
        if (destroyed) return;

        container.style.display = "block";
        positionTooltip();
        console.log({
            containerPosition: container.style.position,
            top: container.style.top,
            left: container.style.left,
            width: container.offsetWidth,
            height: container.offsetHeight,
        });
    }

    function hide(): void {
        if (destroyed) return;

        container.style.display = "none";
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

        video.pause();
        video.removeAttribute("src");
        video.load();

        container.remove();
        video.removeEventListener("loadedmetadata", positionTooltip);
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

    if ((options.trigger ?? "hover") === "hover") {
        element.addEventListener("mouseenter", handleMouseEnter);
        element.addEventListener("mouseleave", handleMouseLeave);

        container.addEventListener("mouseenter", cancelHide);
        container.addEventListener("mouseleave", handleMouseLeave);
    }

    return {
        show,
        hide,
        destroy
    };




}