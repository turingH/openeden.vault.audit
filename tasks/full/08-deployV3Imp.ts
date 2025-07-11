import { task } from "hardhat/config";
import { deployVaultV3Impl } from "../../helpers/contracts-deployments";

// export NODE_ENV=staging
// npx hardhat full:deploy_vault_v3_impl  --network goerli --verify
// npx hardhat full:deploy_vault_v3_impl  --network eth_main --verify

task("full:deploy_vault_v3_impl", "Deploy Vault V3 Implementation")
  .addFlag("verify", "Verify contracts at Etherscan")
  .setAction(async ({ verify }, localDRE) => {
    console.log("verify:", verify);
    localDRE.run("set-DRE");

    const vaultV3Impl = await deployVaultV3Impl(verify);
    console.log("vaultV3Impl address:", vaultV3Impl.address);
  });
