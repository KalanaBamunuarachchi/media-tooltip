export type TooltipPostion = | "top" | "bottom" | "left" | "right" ;
export type TooltipTrigger = | "hover" | "click" ;

export type TooltipOptions = {
    media: string;
    position?: TooltipPostion;
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
}

