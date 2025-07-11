import { task } from "hardhat/config";
import { deployKycManager } from "../../helpers/contracts-deployments";

// export NODE_ENV=staging
// export NODE_ENV=ethereum
// npx hardhat full:deploy_kyc_manager  --network goerli --verify
// npx hardhat full:deploy_kyc_manager  --network eth_main --verify

task("full:deploy_kyc_manager", "Deploy Kyc Manager")
  .addFlag("verify", "Verify contracts at Etherscan")
  .setAction(async ({ verify }, localDRE) => {
    console.log("verify:", verify);
    localDRE.run("set-DRE");

    console.log("network:", localDRE.network.name);
    const kycManager = await deployKycManager(verify);
    console.log("kycManager address:", kycManager.address);
  });
