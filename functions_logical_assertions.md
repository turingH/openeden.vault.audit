
# OpenEdenVaultV4Impl.sol 形式化逻辑断言

本文档包含了对 `OpenEdenVaultV4Impl.sol` 合约中所有函数的形式化逻辑分析。每个函数被分解为一组原子化的“微断言”，这些断言组合起来构成了函数所有可能的逻辑执行路径。

---

## Modifiers

### `onlyOperator`

📌 微断言：
- A: `operators[msg.sender]` 为 `true`。
- B: `operators[msg.sender]` 为 `false`。
- C: 函数体继续执行。
- D: 交易回滚，错误为 `TBillNoPermission(msg.sender)`。

🎯 路径组合：
- G1 (成功): A ∧ C
- G2 (失败): B ∧ D

---

### `onlyMaintainer`

📌 微断言：
- A: `msg.sender == maintainer`。
- B: `msg.sender != maintainer`。
- C: 函数体继续执行。
- D: 交易回滚，错误为 `TBillNoPermission(msg.sender)`。

🎯 路径组合：
- G1 (成功): A ∧ C
- G2 (失败): B ∧ D

---

## External/Public Functions

### `deposit(uint256 _assets, address _receiver)`

📌 微断言：
- A: `controller.requireNotPausedDeposit()` 未回滚。
- B: `_validateKyc(sender, _receiver)` 未回滚。
- C: `_assets >= minDeposit`。
- D: `_assets < minDeposit`，交易回滚，错误为 `TBillLessThanMin`。
- E: `firstDepositMap[sender]` 为 `false` (首次存款)。
- F: `firstDepositMap[sender]` 为 `true` (非首次存款)。
- G: `_assets >= firstDepositAmt`。
- H: `_assets < firstDepositAmt`，交易回滚，错误为 `TBillLessThanFirstDeposit`。
- I: `firstDepositMap[sender]` 被设置为 `true`。
- J: 调用 `_processDeposit(sender, _receiver, _assets)`。

🎯 路径组合：
- G1 (成功, 首次存款): A ∧ B ∧ C ∧ E ∧ G ∧ I ∧ J
- G2 (成功, 后续存款): A ∧ B ∧ C ∧ F ∧ J
- G3 (失败, 低于最小存款额): A ∧ B ∧ D
- G4 (失败, 首次存款低于首次存款额): A ∧ B ∧ C ∧ E ∧ H

---

### `redeem(uint256 _shares, address _receiver)`

📌 微断言：
- A: `controller.requireNotPausedWithdraw()` 未回滚。
- B: `_validateKyc(sender, _receiver)` 未回滚。
- C: `assets = _convertToAssets(_shares)`。
- D: `assets >= minWithdraw`。
- E: `assets < minWithdraw`，交易回滚，错误为 `TBillLessThanMin`。
- F: 调用 `_processWithdraw(sender, _receiver, _shares)`。

🎯 路径组合：
- G1 (成功): A ∧ B ∧ C ∧ D ∧ F
- G2 (失败, 低于最小提款额): A ∧ B ∧ C ∧ E

---

### `redeemIns(uint256 _shares, address _receiver)`

📌 微断言：
- A: `controller.requireNotPausedWithdraw()` 未回滚。
- B: `_validateKyc(sender, _receiver)` 未回滚。
- C: `assets = _convertToAssets(_shares)`。
- D: 计算 `totalFee`。
- E: 调用 `_processWithdrawIns(sender, _receiver, _shares, assets, totalFee)` 并返回其结果。

🎯 路径组合：
- G1 (成功): A ∧ B ∧ C ∧ D ∧ E

---

### `cancel(uint256 _len)`

📌 微断言：
- A: `onlyMaintainer` 修饰符通过。
- B: `_len <= withdrawalQueue.length()`。
- C: `_len > withdrawalQueue.length()`，交易回滚，错误为 `TBillInvalidInput`。
- D: `controller.requireNotPausedWithdraw()` 未回滚。
- E: 循环 `_len` 次，每次从未完成提现队列 `withdrawalQueue` 中弹出一个请求。
- F: 对每个弹出的请求，将 `shares` 从合约转回给 `sender`。
- G: 更新状态变量 `totalShares`, `withdrawalInfo`。
- H: 触发 `ProcessRedeemCancel` 事件。
- I: 触发 `Cancel` 事件。

🎯 路径组合：
- G1 (成功): A ∧ B ∧ D ∧ E ∧ F ∧ G ∧ H ∧ I
- G2 (失败, 无效长度): A ∧ C

---

### `offRamp(uint256 _amt)`

📌 微断言：
- A: `onlyOperator` 修饰符通过。
- B: 调用 `_offRamp(address(underlying), treasury, _amt)`。
- C: 触发 `OffRamp` 事件。

🎯 路径组合：
- G1 (成功): A ∧ B ∧ C

---

### `offRampQ(address _token, uint256 _amt)`

📌 微断言：
- A: `onlyOperator` 修饰符通过。
- B: `_token != address(this)`。
- C: `_token == address(this)`，交易回滚，错误为 `TBillInvalidInput`。
- D: 调用 `_offRamp(_token, qTreasury, _amt)`。
- E: 触发 `OffRampQ` 事件。

🎯 路径组合：
- G1 (成功): A ∧ B ∧ D ∧ E
- G2 (失败, 无效代币): A ∧ C

---

### `processWithdrawalQueue(uint _len)`

📌 微断言：
- A: `onlyOperator` 修饰符通过。
- B: `withdrawalQueue.length() > 0` 且 `_len <= withdrawalQueue.length()`。
- C: `withdrawalQueue.length() == 0` 或 `_len > withdrawalQueue.length()`，交易回滚，错误为 `TBillInvalidInput`。
- D: `_len` 被有效设置（如果输入为0，则设为队列长度）。
- E: 循环处理队列项。
- F: (循环内) `_validateKyc` 通过。
- G: (循环内) `assets <= onchainAssets()`。
- H: (循环内) `assets > onchainAssets()`，循环中断。
- I: (循环内) 计算并收取费用。
- J: (循环内) `withdrawalQueue.popFront()` 被调用。
- K: (循环内) 状态变量 (`totalWithdrawAssets`, `totalBurnShares`, `totalFees`, `withdrawalInfo`) 被更新。
- L: (循环内) `_withdraw` 被调用。
- M: (循环内) `ProcessWithdraw` 事件被触发。
- N: `ProcessWithdrawalQueue` 事件被触发。

🎯 路径组合：
- G1 (失败, 无效输入): A ∧ C
- G2 (成功, 处理0个请求因资产不足): A ∧ B ∧ D ∧ E ∧ F ∧ H ∧ N
- G3 (成功, 处理k个请求后因资产不足停止): A ∧ B ∧ D ∧ E ∧ ((F ∧ G ∧ I ∧ J ∧ K ∧ L ∧ M) 执行k次) ∧ (F ∧ H) ∧ N
- G4 (成功, 处理所有_len个请求): A ∧ B ∧ D ∧ E ∧ ((F ∧ G ∧ I ∧ J ∧ K ∧ L ∧ M) 执行_len次) ∧ N

---

### `updateEpoch(bool _isWeekend)`

📌 微断言：
- A: `onlyOperator` 修饰符通过。
- B: `lastUpdateTS == 0` (首次更新)。
- C: `lastUpdateTS != 0`。
- D: `block.timestamp >= lastUpdateTS + timeBuffer`。
- E: `block.timestamp < lastUpdateTS + timeBuffer`，交易回滚，错误为 `TBillUpdateTooEarly`。
- F: `epoch` 增加 1。
- G: `isWeekend` 被设置为 `_isWeekend`。
- H: 计算服务费并累加到 `unClaimedFee`。
- I: `lastUpdateTS` 更新为 `block.timestamp`。
- J: 触发 `UpdateEpoch` 事件。

🎯 路径组合：
- G1 (成功, 首次): A ∧ B ∧ F ∧ G ∧ H ∧ I ∧ J
- G2 (成功, 后续): A ∧ C ∧ D ∧ F ∧ G ∧ H ∧ I ∧ J
- G3 (失败, 更新太早): A ∧ C ∧ E

---

### `setWeekendFlag(bool _isWeekend)`

📌 微断言：
- A: `onlyOperator` 修饰符通过。
- B: `isWeekend` 被设置为 `_isWeekend`。
- C: 触发 `SetWeekendFlag` 事件。

🎯 路径组合：
- G1 (成功): A ∧ B ∧ C

---

### `claimServiceFee(uint256 _amt)`

📌 微断言：
- A: `onlyOperator` 修饰符通过。
- B: `mgtFeeTreasury != address(0)`。
- C: `mgtFeeTreasury == address(0)`，交易回滚，错误为 `TBillZeroAddress`。
- D: `unClaimedFee` 减少 `_amt`。
- E: `_amt` 数量的 `underlying` Token 被安全转移到 `mgtFeeTreasury`。
- F: 触发 `ClaimServiceFee` 事件。

🎯 路径组合：
- G1 (成功): A ∧ B ∧ D ∧ E ∧ F
- G2 (失败, 零地址): A ∧ C

---

### Set/Update Functions (Owner/Maintainer only)

这类函数（如 `setOplTreasury`, `setMaintainer`, `setPartnerShip` 等）遵循相似的逻辑模式。

#### `setOplTreasury(address _opl)` (示例)

📌 微断言：
- A: `onlyOwner` 修饰符通过。
- B: `_opl != address(0)`。
- C: `_opl == address(0)`，交易回滚，错误为 `TBillZeroAddress`。
- D: `oplTreasury` 被更新为 `_opl`。
- E: 触发 `SetOplTreasury` 事件。

🎯 路径组合：
- G1 (成功): A ∧ B ∧ D ∧ E
- G2 (失败, 零地址): A ∧ C

*其他 `set*` 函数如 `setMgtFeeTreasury`, `setFeeManager`, `setKycManager`, `setTBillPriceFeed`, `setController`, `setTreasury`, `setQTreasury`, `setPartnerShip`, `setMaintainer`, `setTimeBuffer`, `setFirstDeposit`, `setRedemption`, `setTotalSupplyCap` 均遵循此模式，只是具体的状态变量和事件不同。*

---

### `setOperator(address[] memory _operators, bool[] memory statuses)`

📌 微断言：
- A: `onlyMaintainer` 修饰符通过。
- B: 循环遍历 `_operators` 和 `statuses` 数组。
- C: (循环内) `operators` 映射中对应地址的状态被更新。
- D: (循环内) 触发 `SetOperator` 事件。

🎯 路径组合：
- G1 (成功): A ∧ B ∧ (C ∧ D 的循环)

---

### View/Pure Functions

这类函数（如 `getWithdrawalQueueInfo`, `txsFee`, `totalAssets` 等）主要用于读取状态和计算，不改变状态（`view`/`pure`）。

#### `getWithdrawalQueueInfo(uint256 _index)` (示例)

📌 微断言：
- A: `withdrawalQueue` 不为空 且 `_index` 在队列长度范围内。
- B: `withdrawalQueue` 为空 或 `_index` 超出范围。
- C: 返回位于 `_index` 的提现信息。
- D: 返回零值。

🎯 路径组合：
- G1 (成功): A ∧ C
- G2 (失败, 无效索引): B ∧ D

---

#### `tbillUsdcRate()` (示例)

📌 微断言：
- A: `tbillUsdPriceFeed.latestRoundData()` 返回价格 `answer`。
- B: `answer >= 0` 且 `uint256(answer) >= ONE`。
- C: `answer < 0` 或 `uint256(answer) < ONE`，交易回滚，错误为 `TBillInvalidPrice`。
- D: `block.timestamp - updatedAt <= 7 days`。
- E: `block.timestamp - updatedAt > 7 days`，交易回滚，错误为 `TBillPriceOutdated`。
- F: 计算并返回费率。

🎯 路径组合：
- G1 (成功): A ∧ B ∧ D ∧ F
- G2 (失败, 无效价格): A ∧ C
- G3 (失败, 价格过时): A ∧ B ∧ E

---

### `burnFrom(address _from, uint256 _amount)`

📌 微断言：
- A: `onlyMaintainer` 修饰符通过。
- B: `_from != address(0)`。
- C: `_amount != 0`。
- D: `balanceOf(_from) >= _amount`。
- E: `_validateKyc` 通过。
- F: `_burn(_from, _amount)` 被调用。
- G: 触发 `BurnFrom` 事件。
- H: 任何前置条件（B, C, D）失败则交易回滚。

🎯 路径组合：
- G1 (成功): A ∧ B ∧ C ∧ D ∧ E ∧ F ∧ G
- G2 (失败): A ∧ (¬B ∨ ¬C ∨ ¬D) ∧ H

---

### `mintTo(address _to, uint256 _amount)`

📌 微断言：
- A: `onlyMaintainer` 修饰符通过。
- B: `_to != address(0)`。
- C: `_amount != 0`。
- D: `totalSupply() + _amount <= totalSupplyCap`。
- E: `totalSupply() + _amount > totalSupplyCap`，交易回滚，错误为 `TotalSupplyCapExceeded`。
- F: `_validateKyc` 通过。
- G: `_mint(_to, _amount)` 被调用。
- H: 触发 `MintTo` 事件。
- I: 地址或数量无效，交易回滚。

🎯 路径组合：
- G1 (成功): A ∧ B ∧ C ∧ D ∧ F ∧ G ∧ H
- G2 (失败, 超过上限): A ∧ B ∧ C ∧ E
- G3 (失败, 无效输入): A ∧ (¬B ∨ ¬C) ∧ I

---

### `reIssue(address _oldWallet, address _newWallet, uint256 _amount)`

📌 微断言：
- A: `onlyMaintainer` 修饰符通过。
- B: `_oldWallet` 和 `_newWallet` 均不为零地址。
- C: `_amount != 0`。
- D: `balanceOf(_oldWallet) >= _amount`。
- E: `_validateKyc(_oldWallet, _newWallet)` 通过。
- F: `_burn(_oldWallet, _amount)` 被调用。
- G: `_mint(_newWallet, _amount)` 被调用。
- H: 触发 `ReIssue` 事件。
- I: 任何前置条件（B, C, D）失败则交易回滚。

🎯 路径组合：
- G1 (成功): A ∧ B ∧ C ∧ D ∧ E ∧ F ∧ G ∧ H
- G2 (失败): A ∧ (¬B ∨ ¬C ∨ ¬D) ∧ I

---

## Internal Functions

### `_processDeposit(...)`

📌 微断言：
- A: 调用 `txsFee` 计算费用 `totalFee`。
- B: `totalFee > 0`。
- C: `totalFee == 0`。
- D: 从 `_sender` 向 `oplTreasury` 转移 `totalFee` 数量的 `underlying`。
- E: `trimmedAssets = _assets - totalFee`。
- F: `shares = _convertToShares(trimmedAssets)`。
- G: `totalSupply() + shares <= totalSupplyCap`。
- H: `totalSupply() + shares > totalSupplyCap`，交易回滚，错误为 `TotalSupplyCapExceeded`。
- I: 调用 `_deposit(_sender, _receiver, trimmedAssets, shares, treasury)`。
- J: 触发 `ProcessDeposit` 事件。

🎯 路径组合：
- G1 (成功, 有费用): A ∧ B ∧ D ∧ E ∧ F ∧ G ∧ I ∧ J
- G2 (成功, 无费用): A ∧ C ∧ E ∧ F ∧ G ∧ I ∧ J
- G3 (失败, 超过上限): A ∧ (B ∨ C) ∧ E ∧ F ∧ H

---

### `_processWithdraw(...)`

📌 微断言：
- A: `withdrawalInfo[_receiver]` 增加 `_shares`。
- B: 生成唯一的提现ID `id`。
- C: 将提现请求编码并压入 `withdrawalQueue`。
- D: 将 `_shares` 从 `_sender` 转移到合约自身。
- E: 触发 `AddToWithdrawalQueue` 事件。

🎯 路径组合：
- G1 (成功): A ∧ B ∧ C ∧ D ∧ E

---

### `_processWithdrawIns(...)`

📌 微断言：
- A: 将 `_shares` 从 `_sender` 转移到合约自身。
- B: 调用 `redemptionContract.redeem`。
- C: `usdcReceived >= _assets`。
- D: `usdcReceived < _assets`，交易回滚，错误为 `TBillReceiveUSDCFailed`。
- E: 计算 `_assetsToUser = _assets - _totalFee`。
- F: 调用 `_withdraw` 将 `_assetsToUser` 发送给 `_receiver` 并销毁 `_shares`。
- G: 如果 `_totalFee > 0`，将费用转移到 `oplTreasury`。
- H: 触发 `ProcessWithdraw` 事件。
- I: 返回 `_assetsToUser`。

🎯 路径组合：
- G1 (成功): A ∧ B ∧ C ∧ E ∧ F ∧ G ∧ H ∧ I
- G2 (失败, USDC接收不足): A ∧ B ∧ D

---

### `_beforeTokenTransfer(...)`

📌 微断言：
- A: `_from == address(0)` 或 `_to == address(0)` (铸币或销毁场景)。
- B: `_from != address(0)` 且 `_to != address(0)` (普通转账场景)。
- C: 调用 `_validateKyc(_from, _to)`。
- D: 函数直接返回。

🎯 路径组合：
- G1 (铸币/销毁): A ∧ D
- G2 (普通转账): B ∧ C

---

### `_validateKyc(address _from, address _to)`

📌 微断言：
- A: `kycManager.isKyc(_from)` 为 `true`。
- B: `kycManager.isKyc(_to)` 为 `true`。
- C: `kycManager.isBanned(_from)` 为 `false`。
- D: `kycManager.isBanned(_to)` 为 `false`。
- E: 函数未回滚。
- F: 任何一个条件不满足，交易回滚，错误为 `TBillInvalidateKyc`。

🎯 路径组合：
- G1 (成功): A ∧ B ∧ C ∧ D ∧ E
- G2 (失败): ¬(A ∧ B ∧ C ∧ D) ∧ F 