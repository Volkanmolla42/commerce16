import clsx from "clsx";
import { formatMoney } from "@/lib/format-money";

const Price = ({
  amount,
  maxAmount,
  className,
  currencyCode = "TRY",
  currencyCodeClassName,
  ...props
}: {
  amount: string;
  maxAmount?: string;
  className?: string;
  currencyCode?: string;
  currencyCodeClassName?: string;
} & React.ComponentProps<"p">) => (
  <p className={className} {...props}>
    <span>{formatMoney(amount, currencyCode)}</span>
    {maxAmount && Number(maxAmount) !== Number(amount) && <><span aria-hidden="true"> ile </span><span>{formatMoney(maxAmount, currencyCode)}</span></>}
    <span
      className={clsx("ml-1 inline", currencyCodeClassName)}
    >{`${currencyCode}`}</span>
  </p>
);

export default Price;
