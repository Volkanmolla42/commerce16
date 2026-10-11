import clsx from "clsx";
import Image from "next/image";
import Label from "../label";
import { ProductImageTransition } from "@/components/product/product-image-transition";

export function GridTileImage({
  active,
  label,
  alt,
  transitionImage = false,
  ...props
}: {
  active?: boolean;
  transitionImage?: boolean;
  label?: {
    title: string;
    amount: string;
    maxAmount?: string;
    currencyCode: string;
    position?: "bottom" | "center";
  };
} & React.ComponentProps<typeof Image>) {
  const image = props.src ? (
    <Image className="relative h-full w-full object-contain" alt={alt ?? ""} {...props} />
  ) : null;

  return (
    <div
      className={clsx(
        "flex h-full w-full items-center justify-center overflow-hidden rounded-lg border bg-white hover:border-blue-600 dark:bg-black",
        {
          relative: label,
          "border-2 border-blue-600": active,
          "border-neutral-200 dark:border-neutral-800": !active,
        },
      )}
    >
      {transitionImage ? <ProductImageTransition>{image}</ProductImageTransition> : image}
      {label ? (
        <Label
          title={label.title}
          amount={label.amount}
          maxAmount={label.maxAmount}
          currencyCode={label.currencyCode}
          position={label.position}
        />
      ) : null}
    </div>
  );
}
