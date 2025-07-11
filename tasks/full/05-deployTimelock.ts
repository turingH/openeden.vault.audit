import { task } from "hardhat/config";
import { deployTimelock } from "../../helpers/contracts-deployments";
import config from "config";

// export NODE_ENV=staging
// npx hardhat full:deploy_timelock  --network goerli --verify
// npx hardhat full:deploy_timelock  --network eth_main --verify

task("full:deploy_timelock", "Deploy Controller")
  .addFlag("verify", "Verify contracts at Etherscan")
  .setAction(async ({ verify }, localDRE) => {
    console.log("verify:", verify);
    localDRE.run("set-DRE");

    const data = config.get("TIME_LOCK");
    console.log("para:", data);

    const timelock = await deployTimelock(
      data.MIN_DELAY,
      data.PROPOSERS,
      data.EXECUTORS,
      data.ADMIN,
      verify
    );

    console.log("timelock address:", timelock.address);
  });
