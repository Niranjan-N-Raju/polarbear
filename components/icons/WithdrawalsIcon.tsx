import { faMoneyBillTransfer } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

interface IconProps {
  className?: string;
}

export function WithdrawalsIcon({
  className = "w-5 h-5 shrink-0",
}: Readonly<IconProps>) {
  return <FontAwesomeIcon icon={faMoneyBillTransfer} className={className} aria-hidden="true" />;
}
