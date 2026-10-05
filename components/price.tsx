import clsx from "clsx";
import { formatMoney } from "@/lib/format-money";

const Price = ({
  amount,
  className,
  currencyCode = "TRY",
  currencyCodeClassName,
  ...props
}: {
  amount: string;
  className?: string;
  currencyCode?: string;
  currencyCodeClassName?: string;
} & React.ComponentProps<"p">) => (
  <p className={className} {...props}>
    {formatMoney(amount, currencyCode)}
    <span
      className={clsx("ml-1 inline", currencyCodeClassName)}
    >{`${currencyCode}`}</span>
  </p>
);

export default Price;
