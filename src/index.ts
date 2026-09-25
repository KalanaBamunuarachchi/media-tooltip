import type { TooltipInstance, TooltipOptions } from "./types";

export function tooltip(
    target: string | HTMLElement,
    options: TooltipOptions
): TooltipInstance {
    let element: HTMLElement;

    if (typeof target === "string") {
        const element =
            typeof target === "string"
                ? document.querySelector<HTMLElement>(target)
                : target;

        if (!element) {
            throw new Error(`Tooltip target not found: ${target}`);
        }

        const container = document.createElement("div");
        const video = document.createElement("video");

        video.src = options.media;
        video.autoplay = options.autoplay ?? true;
        video.loop = options.loop ?? true;
        video.muted = options.muted ?? true;

        container.appendChild(video);
    }
    throw new Error("Not implemented");

}