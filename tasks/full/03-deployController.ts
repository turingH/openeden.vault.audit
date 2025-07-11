import { task } from "hardhat/config";
import { deployController } from "../../helpers/contracts-deployments";
import config from "config";

// export NODE_ENV=staging
// npx hardhat full:deploy_controller  --network goerli --verify
// npx hardhat full:deploy_controller  --network eth_main --verify

task("full:deploy_controller", "Deploy Controller")
  .addFlag("verify", "Verify contracts at Etherscan")
  .setAction(async ({ verify }, localDRE) => {
    console.log("verify:", verify);
    localDRE.run("set-DRE");

    const operator = config.get("CONTROLLER.OPERATOR");
    const admin = config.get("CONTROLLER.ADMIN");
    console.log("operator:", operator);
    console.log("admin:", admin);

    const controller = await deployController(operator, admin, verify);
    console.log("controller address:", controller.address);
  });
