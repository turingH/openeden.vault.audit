import { task } from "hardhat/config";
import { deployPartnerShip } from "../../helpers/contracts-deployments";

// export NODE_ENV=staging
// export NODE_ENV=ethereum
// npx hardhat full:deploy_partnership  --network goerli --verify
// npx hardhat full:deploy_partnership  --network eth_main --verify

task("full:deploy_partnership", "Deploy partnership")
  .addFlag("verify", "Verify contracts at Etherscan")
  .setAction(async ({ verify }, localDRE) => {
    console.log("verify:", verify);
    localDRE.run("set-DRE");

    console.log("network:", localDRE.network.name);
    const partnership = await deployPartnerShip(verify);
    console.log("partnership address:", partnership.address);
  });
