import { task } from "hardhat/config";
import { deployMockBuidlRedemption } from "../../helpers/contracts-deployments";
import { getMockBuidl } from "../../helpers/contracts-getters";

// export NODE_ENV=staging
// npx hardhat full:deploy_buidl_redemption  --network sepolia --verify

task("full:deploy_buidl_redemption", "Deploy mock buidl redemption")
  .addFlag("verify", "Verify contracts at Etherscan")
  .setAction(async ({ verify }, localDRE) => {
    console.log("verify:", verify);
    localDRE.run("set-DRE");

    const buidl = await getMockBuidl();
    // const mockUSDC = "0x7069C635d6fCd1C3D0cd9b563CDC6373e06052ee"; // sepolia
    const mockUSDC = "0x6Eda4B3B452a7B9640E0439DD24258c9FdD037bf"; // arbi sepolia

    const buidlRedemption = await deployMockBuidlRedemption(
      buidl.address,
      mockUSDC,
      verify
    );
    console.log("buidlRedemption address:", buidlRedemption.address);
  });
