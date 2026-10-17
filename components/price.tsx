import { formatMoney } from "@/lib/format-money";

const Price = ({
  amount,
  maxAmount,
  compareAtAmount,
  className,
  currencyCode = "TRY",
  ...props
}: {
  amount: string;
  maxAmount?: string;
  compareAtAmount?: string;
  className?: string;
  currencyCode?: string;
} & React.ComponentProps<"p">) => (
  <p className={className} {...props}>
    {compareAtAmount && Number(compareAtAmount) > Number(amount) && (
      <s className="mr-1.5 text-[0.75em] font-normal text-muted-foreground line-through">
        {formatMoney(compareAtAmount, currencyCode)}
      </s>
    )}
    <span>{formatMoney(amount, currencyCode)}</span>
    {maxAmount && Number(maxAmount) !== Number(amount) && <><span aria-hidden="true" className="mx-1">ile</span><span>{formatMoney(maxAmount, currencyCode)}</span></>}
  </p>
);

export default Price;
