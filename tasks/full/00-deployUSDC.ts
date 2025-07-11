import { task } from "hardhat/config";
import { deployUSDC } from "../../helpers/contracts-deployments";

// export NODE_ENV=staging
// export NODE_ENV=ethereum
// npx hardhat full:deploy_usdc  --network goerli --verify
// npx hardhat full:deploy_usdc  --network eth_main --verify

task("full:deploy_usdc", "Deploy usdc")
  .addFlag("verify", "Verify contracts at Etherscan")
  .setAction(async ({ verify }, localDRE) => {
    console.log("verify:", verify);
    localDRE.run("set-DRE");

    console.log("network:", localDRE.network.name);
    const kycManager = await deployUSDC(verify);
    console.log("kycManager address:", kycManager.address);
  });
