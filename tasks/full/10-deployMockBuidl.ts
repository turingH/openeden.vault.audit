import { task } from "hardhat/config";
import { deployMockBuidl } from "../../helpers/contracts-deployments";

// npx hardhat full:deploy_mock_buidl  --network sepolia --verify

task("full:deploy_mock_buidl", "Deploy mock buidl")
  .addFlag("verify", "Verify contracts at Etherscan")
  .setAction(async ({ verify }, localDRE) => {
    console.log("verify:", verify);
    localDRE.run("set-DRE");

    const buidl = await deployMockBuidl(verify);
    console.log("buidl address:", buidl.address);
  });
