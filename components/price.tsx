import { formatMoney } from "@/lib/format-money";

const Price = ({
  amount,
  maxAmount,
  className,
  currencyCode = "TRY",
  ...props
}: {
  amount: string;
  maxAmount?: string;
  className?: string;
  currencyCode?: string;
} & React.ComponentProps<"p">) => (
  <p className={className} {...props}>
    <span>{formatMoney(amount, currencyCode)}</span>
    {maxAmount && Number(maxAmount) !== Number(amount) && <><span aria-hidden="true" className="mx-1">ile</span><span>{formatMoney(maxAmount, currencyCode)}</span></>}
  </p>
);

export default Price;
