import { formatMoney } from "@/lib/format-money";

const Price = ({
  amount,
  maxAmount,
  compareAtAmount,
  className,
  ...props
}: {
  amount: string;
  maxAmount?: string;
  compareAtAmount?: string;
  className?: string;
} & React.ComponentProps<"p">) => (
  <p className={className} {...props}>
    {compareAtAmount && Number(compareAtAmount) > Number(amount) && (
      <s className="mr-1.5 text-[0.75em] font-normal text-muted-foreground line-through">
        {formatMoney(compareAtAmount)}
      </s>
    )}
    <span>{formatMoney(amount)}</span>
    {maxAmount && Number(maxAmount) !== Number(amount) && <><span aria-hidden="true" className="mx-1">ile</span><span>{formatMoney(maxAmount)}</span></>}
  </p>
);

export default Price;
