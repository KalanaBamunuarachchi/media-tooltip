
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

    document.body.appendChild(container);

    //postioning helper func
    const positionTooltip = () => {
        const rect = element.getBoundingClientRect();
        const offset = options.offset ?? 8;
        const position = options.position ?? "top";

        if (position === "top") {
            container.style.top = `${rect.top - container.offsetHeight - offset}px`;
            container.style.left = `${rect.left + (rect.width - container.offsetWidth) / 2}px`;
        } else if (position === "bottom") {
            container.style.top = `${rect.bottom + offset}px`;
            container.style.left = `${rect.left + (rect.width - container.offsetWidth) / 2}px`;
        } else if (position === "left") {
            container.style.top = `${rect.top + (rect.height - container.offsetHeight) / 2}px`;
            container.style.left = `${rect.left - container.offsetWidth - offset}px`;
        } else {
            container.style.top = `${rect.top + (rect.height - container.offsetHeight) / 2}px`;
            container.style.left = `${rect.right + offset}px`;
        }
    };

    function show(): void {
        if (destroyed) return;

        container.style.display = "block";
        positionTooltip();
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