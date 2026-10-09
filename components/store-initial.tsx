type StoreInitialProps = {
  storeName: string;
  size?: "sm" | "xs";
};

export default function StoreInitial({ storeName, size }: StoreInitialProps) {
  const initial = storeName.trim().slice(0, 1).toLocaleUpperCase("tr-TR") || "M";
  const sizeClasses = size === "sm"
    ? "size-[30px] rounded-lg text-xs"
    : size === "xs"
      ? "size-8 rounded-md text-sm"
      : "size-10 rounded-xl text-base";

  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center bg-primary font-semibold text-primary-foreground ${sizeClasses}`}>
      {initial}
    </span>
  );
}
