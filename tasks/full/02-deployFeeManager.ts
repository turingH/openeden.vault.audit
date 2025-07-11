import { task } from "hardhat/config";
import { ethers } from "ethers";
import config from "config";
import { deployFeeManager } from "../../helpers/contracts-deployments";
import { FeeManagerConfig } from "../../helpers/parameter";

// export NODE_ENV=staging eth_main
// npx hardhat full:deploy_fee_manager  --network goerli --verify
// npx hardhat full:deploy_fee_manager  --network eth_main --verify

task("full:deploy_fee_manager", "Deploy Fee Manager")
  .addFlag("verify", "Verify contracts at Etherscan")
  .setAction(async ({ verify }, localDRE) => {
    console.log("verify:", verify);
    localDRE.run("set-DRE");

    const FEE_MANAGER = config.get("FEE_MANAGER");
    const para: FeeManagerConfig = {
      txFeeWorkdayDepositPct: FEE_MANAGER.TX_FEE_WORKDAY_DEPOSIT_PCT, // 5 bps
      txFeeWorkdayWithdrawPct: FEE_MANAGER.TX_FEE_WORKDAY_WITHDRAW_PCT, // 5 bps
      txFeeHolidayDepositPct: FEE_MANAGER.TX_FEE_HOLIDAY_DEPOSIT_PCT,
      txFeeHolidayWithdrawPct: FEE_MANAGER.TX_FEE_HOLIDAY_WITHDRAW_PCT,
      maxHolidayDepositPct: FEE_MANAGER.MAX_HOLIDAY_DEPOSIT_PCT,
      maxHolidayAggDepositPct: FEE_MANAGER.MAX_HOLIDAY_AGG_DEPOSIT_PCT,
      firstDeposit: ethers.BigNumber.from(FEE_MANAGER.FIRST_DEPOSIT),
      minDeposit: ethers.BigNumber.from(FEE_MANAGER.MIN_DEPOSIT),
      maxDeposit: ethers.BigNumber.from(FEE_MANAGER.MAX_DEPOSIT),
      minWithdraw: ethers.BigNumber.from(FEE_MANAGER.MIN_WITHDRAW),
      maxWithdraw: ethers.BigNumber.from(FEE_MANAGER.MAX_WITHDRAW),
      // managementFeeRate: FEE_MANAGER.MANAGEMENT_FEE,
    };

    console.log("para:", para);
    const feeManager = await deployFeeManager(para, verify);
    console.log("feeManager address:", feeManager.address);
  });
