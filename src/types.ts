
export type TooltipPosition = "top" | "bottom" | "left" | "right";

export type TooltipTrigger = "hover" | "click";

export type TooltipOptions = {
    media: string;
    position?: TooltipPosition;
    trigger?: TooltipTrigger;
    width?: number;
    offset?: number;
    autoplay?: boolean;
    loop?: boolean;
    muted?: boolean;
    className?: string;
    onShow?: () => void;
    onHide?: () => void;
};

export type TooltipInstance = {
    show(): void;
    hide(): void;
    destroy(): void;
};

export type MediaTooltipsOptions = {
    selector?: string;
    defaults?: Omit<TooltipOptions, "media">;
};
