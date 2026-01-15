"use client";

import { useState } from "react";
import Image, { ImageProps } from "next/image";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageWithLoadingProps extends ImageProps {
    containerClassName?: string;
}

export function ImageWithLoading({ containerClassName, className, alt, ...props }: ImageWithLoadingProps) {
    const [isLoading, setIsLoading] = useState(true);

    return (
        <div className={cn("relative overflow-hidden", props.fill && "w-full h-full", containerClassName)}>
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-secondary/50 animate-pulse z-10">
                    <Loader2 className="h-6 w-6 text-muted-foreground/50 animate-spin" />
                </div>
            )}
            <Image
                className={cn(
                    "transition-all duration-300",
                    isLoading ? "opacity-0 scale-95" : "opacity-100 scale-100",
                    className
                )}
                alt={alt}
                onLoad={() => setIsLoading(false)}
                {...props}
            />
        </div>
    );
}
