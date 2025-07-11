import { BigNumber } from "ethers";

type FeeManagerConfig = {
  txFeeWorkdayDepositPct: number; // 5 bps
  txFeeWorkdayWithdrawPct: number; // 5 bps
  txFeeHolidayDepositPct: number;
  txFeeHolidayWithdrawPct: number;
  maxHolidayDepositPct: number;
  maxHolidayAggDepositPct: number;
  firstDeposit: BigNumber;
  minDeposit: BigNumber;
  maxDeposit: BigNumber;
  minWithdraw: BigNumber;
  maxWithdraw: BigNumber;
  // managementFeeRate: number;
};

export { FeeManagerConfig };
