
### 🔹 Functional Module Table

| Module Name | Description | Key Functions |
|---|---|---|
| Vault Core | Handles primary user interactions for depositing assets and redeeming shares. | `deposit()`, `redeem()`, `redeemIns()` |

---

### 🔁 Behavioral Flow Format (Per Module)

## Module: Vault Core

This module is responsible for the primary user interactions with the vault: depositing underlying assets (USDC) and redeeming shares for the underlying assets. It supports both a queued withdrawal mechanism and an instant redemption option.

---

### 🎯 Feature 1: Deposit Assets to Mint Shares

**User Goal:** Deposit USDC to receive T-Bill-backed vault shares.

**Execution Steps:**

1.  **Initiation**: User calls `deposit(uint256 _assets, address _receiver)`.
2.  **Pre-checks**:
    *   The contract verifies that deposits are not paused using `controller.requireNotPausedDeposit()`.
    *   It ensures both the sender and receiver have valid KYC status via `kycManager`.
3.  **Amount Validation**:
    *   Retrieves minimum deposit and first-time deposit thresholds from `feeManager`.
    *   Reverts if the `_assets` amount is below the required minimums.
4.  **Fee Calculation & Collection**:
    *   The contract calculates a transaction fee via the `txsFee()` function, which may include a base fee and a partnership fee.
    *   The total fee is transferred from the user to the `oplTreasury`.
5.  **Share Calculation**:
    *   The net asset amount (deposit minus fee) is converted into a corresponding number of shares using the `_convertToShares()` internal function, which relies on the T-Bill/USDC price from `tbillUsdcRate()`.
6.  **Supply Cap Check**:
    *   The contract ensures that minting the new shares will not exceed the `totalSupplyCap`.
7.  **State Updates**:
    *   The net USDC amount is transferred from the user to the vault's `treasury`.
    *   The calculated shares are minted to the `_receiver`.
8.  **Event Logging**: Emits a `ProcessDeposit` event with details of the transaction.

---

### 🎯 Feature 2: Redeem Shares for Assets (Queued)

**User Goal:** Redeem vault shares for USDC. The request is added to a queue for later processing.

**Execution Steps:**

1.  **Initiation**: User calls `redeem(uint256 _shares, address _receiver)`.
2.  **Pre-checks**:
    *   Verifies that withdrawals are not paused via `controller.requireNotPausedWithdraw()`.
    *   Validates the KYC status of the sender and receiver.
3.  **Amount Validation**:
    *   Converts `_shares` to the equivalent asset amount to check against the minimum withdrawal threshold from `feeManager`.
4.  **Queue Management**:
    *   The user's shares are transferred to the vault contract, effectively locking them.
    *   A unique withdrawal ID is generated.
    *   The request (sender, receiver, shares, ID) is encoded and pushed into the `withdrawalQueue`.
    *   The `withdrawalInfo` mapping is updated to reflect the user's pending withdrawal.
5.  **Event Logging**: Emits an `AddToWithdrawalQueue` event.

> **Note**: The actual processing of this withdrawal happens later when an operator calls `processWithdrawalQueue()`.

---

### 🎯 Feature 3: Redeem Shares for Assets (Instant)

**User Goal:** Instantly redeem vault shares for USDC by leveraging an external redemption facility, bypassing the queue.

**Execution Steps:**

1.  **Initiation**: User calls `redeemIns(uint256 _shares, address _receiver)`.
2.  **Pre-checks**:
    *   Performs standard pause and KYC checks.
3.  **Fee Calculation**:
    *   Calculates the transaction fee for the redemption action via `txsFee()`.
4.  **Core Redemption Logic** (within `_processWithdrawIns`):
    *   **Share Transfer**: The user's `_shares` are transferred to the vault contract.
    *   **External Redemption**: The contract calls `redeem()` on the configured `redemptionContract`, which is expected to return USDC to the vault. The call reverts if the returned USDC is insufficient.
    *   **Asset & Fee Transfer**:
        *   The calculated fee is transferred to the `oplTreasury`.
        *   The net USDC amount (redeemed assets minus fee) is transferred to the `_receiver`.
    *   **State Update**: The user's shares, now held by the vault, are burned.
5.  **Event Logging**: Emits a `ProcessWithdraw` event with details of the instant redemption. 

---
---

| Module Name | Description | Key Functions |
|---|---|---|
| Administrative & Governance | Manages vault operations, configuration, and fund flows, executed by privileged roles. | `processWithdrawalQueue()`, `updateEpoch()`, `offRamp()`, `claimServiceFee()`, `set*()` functions |

---

## Module: Administrative & Governance

This module comprises functions restricted to privileged roles (`owner`, `maintainer`, `operator`) for managing the vault's operational parameters, processing queues, handling fees, and performing emergency interventions.

---

### 🎯 Feature 1: Process Queued Withdrawals

**User Goal:** (Operator) Process pending withdrawal requests from the queue to fulfill user redemptions.

**Execution Steps:**

1.  **Initiation**: Operator calls `processWithdrawalQueue(uint _len)`.
2.  **Pre-checks**:
    *   Verifies that the caller is a designated `operator`.
    *   Ensures the queue is not empty and `_len` is a valid length.
3.  **Iterative Processing**: The function iterates through the queue up to `_len` requests:
    *   **Decode Request**: Retrieves and decodes the next request from `withdrawalQueue`.
    *   **Asset Check**: Checks if the vault has sufficient `onchainAssets()` to cover the redemption. If not, the loop breaks, and processing stops.
    *   **Fee Calculation**: Recalculates the transaction fee for the withdrawal at the time of processing.
    *   **Fee Collection**: Transfers the calculated fee to the `oplTreasury`.
    *   **State Updates**:
        *   The request is removed from the queue (`popFront`).
        *   The user's pending withdrawal amount in `withdrawalInfo` is decreased.
    *   **Asset Transfer & Burn**:
        *   The net asset amount (assets minus fee) is transferred to the `receiver`.
        *   The corresponding shares held by the vault are burned.
4.  **Event Logging**: Emits `ProcessWithdraw` for each processed request and a final `ProcessWithdrawalQueue` with aggregate data.

---

### 🎯 Feature 2: Update Epoch and Accrue Fees

**User Goal:** (Operator) Advance the system to a new epoch, marking the passage of a day and accruing management fees.

**Execution Steps:**

1.  **Initiation**: Operator calls `updateEpoch(bool _isWeekend)`.
2.  **Pre-checks**:
    *   Ensures the caller is an `operator`.
    *   Checks that sufficient time (`timeBuffer`) has passed since the last update to prevent premature calls.
3.  **State Updates**:
    *   Increments the `epoch` counter.
    *   Sets the `isWeekend` flag based on the input.
    *   Calculates the management fee for the period based on `totalAssets()` and the `managementFeeRate` from `feeManager`.
    *   Adds the calculated fee to the `unClaimedFee` pool.
    *   Updates `lastUpdateTS` to the current block timestamp.
4.  **Event Logging**: Emits an `UpdateEpoch` event.

---

### 🎯 Feature 3: Manage Vault Funds and Fees

**User Goal:** (Operator/Owner) Move funds between the vault and treasuries, and claim accrued fees.

**Execution Steps:**

*   **Off-Ramp Principal (`offRamp`)**:
    1.  An `operator` calls `offRamp(uint256 _amt)`.
    2.  The function transfers the specified `_amt` of the underlying asset (USDC) from the vault contract to the main `treasury`.
*   **Off-Ramp Quarantine (`offRampQ`)**:
    1.  An `operator` calls `offRampQ(address _token, uint256 _amt)`.
    2.  This allows moving any unexpected or "quarantined" tokens from the vault to the `qTreasury`.
*   **Claim Management Fees (`claimServiceFee`)**:
    1.  An `operator` calls `claimServiceFee(uint256 _amt)`.
    2.  The specified `_amt` is subtracted from `unClaimedFee`.
    3.  The `_amt` of underlying asset is transferred from the vault to the `mgtFeeTreasury`.

---

### 🎯 Feature 4: Configure Vault Parameters

**User Goal:** (Owner/Maintainer) Update critical contract addresses and operational parameters.

**Execution Steps:**

1.  **Initiation**: A privileged user (`owner` or `maintainer`, depending on the function) calls a setter function (e.g., `setFeeManager`, `setController`, `setTBillPriceFeed`, `setTreasury`, `setTotalSupplyCap`, etc.).
2.  **Authorization**: The function's modifier (`onlyOwner` or `onlyMaintainer`) validates the caller's role.
3.  **Input Validation**: The new address or value is typically checked to ensure it's not zero or invalid.
4.  **State Update**: The corresponding state variable (e.g., `feeManager`, `controller`, `totalSupplyCap`) is updated to the new value.
5.  **Event Logging**: An event is emitted to record the change (e.g., `SetFeeManager`, `SetController`).

---

### 🎯 Feature 5: Emergency Interventions

**User Goal:** (Maintainer) Perform manual adjustments to token balances in critical situations.

**Execution Steps:**

*   **Burn Tokens (`burnFrom`)**:
    1.  `maintainer` calls `burnFrom(address _from, uint256 _amount)`.
    2.  After checks, it burns the specified `_amount` of shares directly from the `_from` address.
*   **Mint Tokens (`mintTo`)**:
    1.  `maintainer` calls `mintTo(address _to, uint256 _amount)`.
    2.  It mints `_amount` new shares to the `_to` address, respecting the `totalSupplyCap`.
*   **Re-issue Shares (`reIssue`)**:
    1.  `maintainer` calls `reIssue(address _oldWallet, address _newWallet, uint256 _amount)`.
    2.  This is a combination of `burnFrom` and `mintTo`, effectively moving shares from an old wallet to a new one. 

---
---

| Module Name | Description | Key Functions |
|---|---|---|
| Fee Management | A configuration contract for setting all transaction fees, management fees, and deposit/withdrawal limits. | `set*()` functions, `get*()` functions |

---

## Module: Fee Management

This contract is a centralized, owner-controlled hub for managing all financial parameters of the vault. It allows administrators to dynamically adjust fees and limits without altering the core vault logic. Its functions are not user-facing but are critical for the protocol's economic governance.

---

### 🎯 Feature 1: Configure Protocol Fees and Limits

**User Goal:** (Owner) Set or update the various fee percentages and deposit/withdrawal limits used by the vault.

**Execution Steps:**

1.  **Initiation**: The contract `owner` calls a specific setter function. Examples include:
    *   `setTxFeeWorkdayDepositPct(uint256 txsFee)`
    *   `setTxFeeHolidayWithdrawPct(uint256 txsFee)`
    *   `setManagementFeeRate(uint256 feeRate)`
    *   `setMinDeposit(uint256 minDeposit)`
    *   `setMaxWithdraw(uint256 maxWithdraw)`
    *   `setMinTxsFee(uint256 _fee)`
2.  **Authorization**: The `onlyOwner` modifier ensures that only the designated owner can execute the function.
3.  **State Update**: The contract updates the corresponding internal state variable to the new value provided by the owner.
4.  **Event Logging**: An event is emitted to transparently log the change on-chain (e.g., `SetManagementFeeRate`, `SetMinDeposit`).

---

### 🎯 Feature 2: Provide Fee and Limit Parameters to the Vault

**User Goal:** (Vault Contract) Retrieve the current fee and limit parameters to apply them during user transactions.

**Execution Steps:**

1.  **Initiation**: The main vault contract (`OpenEdenVaultV4Impl`) calls a getter function. Examples include:
    *   `getTxFeePct(ActionType _type, bool _isWeekend)`
    *   `getMinMaxDeposit()`
    *   `getManagementFeeRate()`
2.  **Data Retrieval**: The function reads the relevant internal state variables.
3.  **Conditional Logic**: In the case of `getTxFeePct`, the function returns the appropriate fee percentage based on whether the action is a deposit or withdrawal, and whether it occurs on a weekend.
4.  **Return Value**: The function returns the requested parameter(s) to the calling vault contract, which then uses them in its calculations for user deposits, redemptions, or fee accruals. 

---
---

| Module Name | Description | Key Functions |
|---|---|---|
| KYC Management | Manages user access control through KYC status and blacklisting. | `grantKycInBulk()`, `revokeKycInBulk()`, `bannedInBulk()`, `isKyc()`, `isBanned()` |

---

## Module: KYC Management

This module serves as the gatekeeper for the protocol, ensuring that only authorized and non-banned users can interact with the vault. It uses a role-based access control system to delegate specific KYC-related responsibilities.

---

### 🎯 Feature 1: Manage User KYC Status

**User Goal:** (KYC Administrators) Grant or revoke KYC status for one or multiple users.

**Execution Steps:**

*   **Granting KYC (`grantKycInBulk`)**:
    1.  **Initiation**: A user with the `GRANT_ROLE` calls `grantKycInBulk(address[] calldata _investors, KycType[] calldata _kycTypes)`.
    2.  **Authorization**: The `onlyRole(GRANT_ROLE)` modifier verifies the caller's permission.
    3.  **Input Validation**: Checks that the input arrays have the same length.
    4.  **State Update**: The function iterates through the lists, calling the internal `_grantKyc` function for each user. This updates the `kycType` for each `_investor` in the `userList` mapping.
    5.  **Event Logging**: Emits a `GrantKyc` event for each user.
*   **Revoking KYC (`revokeKycInBulk`)**:
    1.  **Initiation**: A user with the `REVOKE_ROLE` calls `revokeKycInBulk(address[] calldata _investors)`.
    2.  **Authorization**: The `onlyRole(REVOKE_ROLE)` modifier checks the caller's permission.
    3.  **State Update**: The function iterates through the `_investors` array, setting each user's `kycType` to `NON_KYC`.
    4.  **Event Logging**: Emits a `RevokeKyc` event for each user.

---

### 🎯 Feature 2: Manage User Ban Status

**User Goal:** (Ban Administrators) Ban or unban users from interacting with the protocol.

**Execution Steps:**

*   **Banning Users (`bannedInBulk`)**:
    1.  **Initiation**: A user with the `BAN_ROLE` calls `bannedInBulk(address[] calldata _investors)`.
    2.  **Authorization**: Access is restricted by the `onlyRole(BAN_ROLE)` modifier.
    3.  **State Update**: Iterates through the `_investors`, setting their `isBanned` flag to `true` in the `userList` mapping.
    4.  **Event Logging**: Emits a `Banned` event for each user.
*   **Unbanning Users (`unBannedInBulk`)**:
    1.  **Initiation**: A user with the `UNBAN_ROLE` calls `unBannedInBulk(address[] calldata _investors)`.
    2.  **Authorization**: Access is restricted by the `onlyRole(UNBAN_ROLE)` modifier.
    3.  **State Update**: Iterates through the `_investors`, setting their `isBanned` flag to `false`.
    4.  **Event Logging**: Emits a `Banned` event (with status `false`) for each user.

---

### 🎯 Feature 3: Provide KYC Status to the Vault

**User Goal:** (Vault Contract) Check if a user is KYC-approved and not banned before executing a transaction.

**Execution Steps:**

1.  **Initiation**: The main vault contract calls a view function, typically `isKyc(address _investor)` and `isBanned(address _investor)` combined within its `_validateKyc` internal function.
2.  **Data Retrieval**: The function looks up the `_investor` address in the `userList` mapping.
3.  **Return Value**:
    *   `isKyc()` returns `true` if the user's `kycType` is not `NON_KYC`.
    *   `isBanned()` returns the boolean value of the `isBanned` flag.
4.  **Access Control**: The vault contract uses these boolean return values to grant or deny access to its core functions like `deposit` and `redeem`. 

---
---

| Module Name | Description | Key Functions |
|---|---|---|
| Protocol Controller | A global switchboard for pausing and unpausing core protocol functions. | `pauseDeposit()`, `pauseWithdraw()`, `pauseAll()`, `unpauseDeposit()`, `unpauseWithdraw()` |

---

## Module: Protocol Controller

This contract acts as a master switch for the protocol's main functionalities (deposits and withdrawals). It provides administrators and operators with the ability to temporarily halt key operations, which is a crucial feature for security and incident response.

---

### 🎯 Feature 1: Control Protocol State (Pause/Unpause)

**User Goal:** (Admin/Operator) Enable or disable the deposit and withdrawal functions of the vault.

**Execution Steps:**

1.  **Initiation**: A user with either `DEFAULT_ADMIN_ROLE` or `OPERATOR_ROLE` calls one of the control functions:
    *   `pauseDeposit()`
    *   `pauseWithdraw()`
    *   `unpauseDeposit()`
    *   `unpauseWithdraw()`
    *   `pauseAll()`
2.  **Authorization**: The `onlyAdminOrOperator` modifier checks if the caller holds one of the required roles.
3.  **State Update**: The function calls the corresponding internal function from the inherited `OEPausable` contract (e.g., `_pauseDeposit()`). This sets the `_depositPaused` or `_withdrawPaused` boolean flag to `true` or `false`.
4.  **Event Logging**: The underlying `OEPausable` contract emits an event (`DepositPaused`, `DepositUnpaused`, etc.) to signal the state change. `pauseAll()` emits its own `PauseAll` event.

---

### 🎯 Feature 2: Enforce Protocol State on Vault

**User Goal:** (Vault Contract) Ensure that a function can only be executed if it is not currently paused.

**Execution Steps:**

1.  **Initiation**: The main vault contract (`OpenEdenVaultV4Impl`) calls one of the requirement-checking functions at the beginning of its key methods (`deposit` or `redeem`).
    *   `requireNotPausedDeposit()`
    *   `requireNotPausedWithdraw()`
2.  **State Check**: The function checks the value of the respective boolean flag (`_depositPaused` or `_withdrawPaused`).
3.  **Execution Control**: If the relevant flag is `true` (i.e., the action is paused), the function reverts, preventing the rest of the vault's function logic from executing. If the flag is `false`, the function completes successfully, and the vault operation proceeds.

---
---

| Module Name | Description | Key Functions |
|---|---|---|
| Price Oracle | Provides the T-Bill price to the vault, with safeguards against manipulation. | `updatePrice()`, `latestRoundData()`, `updateMaxPriceDeviation()` |

---

## Module: Price Oracle

This contract is the authoritative source for the T-Bill price, a critical input for calculating the vault's asset value and share price. It is designed to be updated periodically by trusted operators, with built-in checks to prevent sudden, drastic price changes.

---

### 🎯 Feature 1: Update T-Bill Price

**User Goal:** (Admin/Operator) Report a new T-Bill price to the oracle.

**Execution Steps:**

1.  **Initiation**: A user with `DEFAULT_ADMIN_ROLE` or `OPERATOR_ROLE` calls `updatePrice(uint256 price)`.
2.  **Authorization**: The `onlyAdminOrOperator` modifier validates the caller's role.
3.  **Price Deviation Check**:
    *   The function calls the internal `_isValidPriceUpdate(price)` to check the new price against the last `_closeNavPrice`.
    *   It calculates the percentage deviation between the new price and the last close price.
    *   The transaction reverts if this deviation exceeds the configured `_maxPriceDeviation`.
4.  **State Update**:
    *   A new price round is created (`_latestRound` is incremented).
    *   The new `RoundData` is stored with the new `price` as the `answer` and the current `block.timestamp` as the `updatedAt`.
5.  **Event Logging**: Emits `UpdatePrice` and `RoundUpdated` events.

---

### 🎯 Feature 2: Provide Price Data to the Vault

**User Goal:** (Vault Contract) Fetch the latest reliable T-Bill price.

**Execution Steps:**

1.  **Initiation**: The vault's `tbillUsdcRate()` function calls `latestRoundData()` on the oracle contract.
2.  **Data Retrieval**: The `latestRoundData()` function returns the data associated with the `_latestRound`, including the price (`answer`) and the update timestamp (`updatedAt`).
3.  **Staleness Check**: The vault contract (in `tbillUsdcRate`) checks if the returned `updatedAt` timestamp is too old (e.g., more than 7 days). If it is, the transaction reverts to prevent operating with stale data.
4.  **Calculation**: The vault uses the trusted price to calculate the T-Bill to USDC conversion rate, which underpins all deposit and redemption calculations.

---

### 🎯 Feature 3: Administrative Price Adjustments

**User Goal:** (Admin) Perform privileged price adjustments.

**Execution Steps:**

*   **Update Close NAV Price (`updateCloseNavPrice`)**:
    1.  An `operator` or `admin` calls `updateCloseNavPrice(uint256 price)`.
    2.  This function updates the `_closeNavPrice`, which is the baseline for the deviation check. It is also protected by the same `_isValidPriceUpdate` check.
*   **Manually Update Close NAV Price (`updateCloseNavPriceManually`)**:
    1.  An `admin` calls `updateCloseNavPriceManually(uint256 price)`.
    2.  This allows the admin to bypass the deviation check and set the `_closeNavPrice` to any value, serving as a high-privilege override mechanism.
*   **Update Max Price Deviation (`updateMaxPriceDeviation`)**:
    1.  An `admin` calls `updateMaxPriceDeviation(uint256 newDeviation)`.
    2.  This allows the admin to change the tolerance for the price deviation check, tightening or loosening the oracle's security constraints. 

---
---

| Module Name | Description | Key Functions |
|---|---|---|
| Partnership | Manages a fee-sharing or rebate system for protocol partners. | `createPartnerShip()`, `updatePartnerShipFees()`, `getFeeByChildAndAction()` |

---

## Module: Partnership

This contract implements a simple, two-tier partnership program. It allows the protocol owner to establish relationships between "parent" (partner) and "child" (referred user) addresses and to define custom fee structures for them. These custom fees can represent rebates for the user or fee-sharing for the partner.

---

### 🎯 Feature 1: Manage Partnerships and Fees

**User Goal:** (Owner) Establish partnership links and set partner-specific fee rates.

**Execution Steps:**

*   **Create Partnerships (`createPartnerShip`)**:
    1.  **Initiation**: The `owner` calls `createPartnerShip(address[] calldata _children, address _parent)`.
    2.  **Authorization**: The `onlyOwner` modifier restricts access.
    3.  **State Update**: The function iterates through the `_children` array and maps each `child` address to the specified `_parent` address in the `childToParent` mapping.
    4.  **Event Logging**: Emits a `PartnerShipCreated` event for each child-parent link established.
*   **Update Partner Fees (`updatePartnerShipFees`)**:
    1.  **Initiation**: The `owner` calls `updatePartnerShipFees(address _parent, int256 _depositFee, int256 _redeemFee)`.
    2.  **Authorization**: Access is restricted to the `owner`.
    3.  **State Update**: Updates the `parentToFees` mapping for the given `_parent` with the new fee structure. The fees can be negative, representing a rebate for the end-user.
    4.  **Event Logging**: Emits a `PartnerShipFeesUpdated` event.

---

### 🎯 Feature 2: Provide Partnership Fee Data to the Vault

**User Goal:** (Vault Contract) Determine if a user is part of a partnership and fetch the relevant fee adjustments.

**Execution Steps:**

1.  **Initiation**: The vault's `txsFee()` function first checks if a user is part of a partnership by calling `isChildHasParent(address child)`.
2.  **Conditional Fee Logic**:
    *   If `isChildHasParent()` returns `true`, the vault then calls `getFeeByChildAndAction(address child, ActionType action)`.
3.  **Data Retrieval**:
    *   `isChildHasParent()` checks if `childToParent[child]` is not a zero address.
    *   `getFeeByChildAndAction()` first finds the user's parent via `childToParent`, then looks up the parent's fee structure in `parentToFees`. It returns the appropriate fee (deposit or redeem) based on the action type.
4.  **Fee Calculation**: The vault's `txsFee()` function takes the returned partnership fee (`pFee`) and adds it to the base OpenEden fee (`oeFee`). Since `pFee` can be negative, this mechanism can result in a lower total fee for the user. 