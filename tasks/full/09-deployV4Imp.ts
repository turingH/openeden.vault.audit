import { task } from "hardhat/config";
import { deployVaultV4Impl } from "../../helpers/contracts-deployments";

// export NODE_ENV=staging
// npx hardhat full:deploy_vault_v4_impl  --network sepolia --verify
// npx hardhat full:deploy_vault_v4_impl  --network eth_main --verify

task("full:deploy_vault_v4_impl", "Deploy Vault V4 Implementation")
  .addFlag("verify", "Verify contracts at Etherscan")
  .setAction(async ({ verify }, localDRE) => {
    console.log("verify:", verify);
    localDRE.run("set-DRE");

    const vaultV4Impl = await deployVaultV4Impl(verify);
    console.log("vaultV4Impl address:", vaultV4Impl.address);
  });
