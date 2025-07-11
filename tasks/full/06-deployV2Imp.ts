import { task } from "hardhat/config";
import { deployVaultV2Impl } from "../../helpers/contracts-deployments";

// export NODE_ENV=staging
// npx hardhat full:deploy_vault_v2_impl  --network goerli --verify
// npx hardhat full:deploy_vault_v2_impl  --network eth_main --verify

task("full:deploy_vault_v2_impl", "Deploy Vault V2 Implementation")
  .addFlag("verify", "Verify contracts at Etherscan")
  .setAction(async ({ verify }, localDRE) => {
    console.log("verify:", verify);
    localDRE.run("set-DRE");

    const vaultV2Impl = await deployVaultV2Impl(verify);
    console.log("vaultV2Impl address:", vaultV2Impl.address);
  });
