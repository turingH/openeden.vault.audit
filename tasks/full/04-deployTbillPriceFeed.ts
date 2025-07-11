import { task } from "hardhat/config";
import { deployTBillPriceFeed } from "../../helpers/contracts-deployments";
import config from "config";

// export NODE_ENV=staging
// npx hardhat full:deploy_tbill_price_feed  --network goerli --verify
// npx hardhat full:deploy_tbill_price_feed  --network eth_main --verify

task("full:deploy_tbill_price_feed", "Deploy Controller")
  .addFlag("verify", "Verify contracts at Etherscan")
  .setAction(async ({ verify }, localDRE) => {
    console.log("verify:", verify);
    localDRE.run("set-DRE");

    const data = config.get("TBILL_PRICE_FEED");
    console.log("para:", data);

    const priceFeed = await deployTBillPriceFeed(
      data.DECIMALS,
      data.MAX_PRICE_DEVIATION,
      data.INIT_PRICE,
      data.CLOSE_NAV_PRICE,
      data.OPERATOR,
      data.ADMIN,
      verify
    );

    console.log("tbill price feed address:", priceFeed.address);
  });
