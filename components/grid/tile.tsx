import clsx from "clsx";
import Image from "next/image";
import Label from "../label";

export function GridTileImage({
  active,
  label,
  alt,
  ...props
}: {
  active?: boolean;
  label?: {
    title: string;
    amount: string;
    maxAmount?: string;
    currencyCode: string;
    position?: "bottom" | "center";
  };
} & React.ComponentProps<typeof Image>) {
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
      {props.src ? (
        <Image
          className="relative h-full w-full object-contain"
          alt={alt ?? ""}
          {...props}
        />
      ) : null}
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
