// SPDX-License-Identifier: MIT
pragma solidity =0.8.9;

import "../interfaces/IPriceFeed.sol";

/**
 * @title MockIncompleteRoundOracle
 * @dev A mock oracle that allows setting roundId and answeredInRound independently
 * for testing incomplete round data scenarios
 */
contract MockIncompleteRoundOracle is IPriceFeed {
    uint8 private _decimals;
    uint80 private _roundId;
    int256 private _answer;
    uint256 private _startedAt;
    uint256 private _updatedAt;
    uint80 private _answeredInRound;

    constructor(uint8 decimals_, int256 initialAnswer_) {
        _decimals = decimals_;
        _roundId = 1;
        _answer = initialAnswer_;
        _startedAt = block.timestamp;
        _updatedAt = block.timestamp;
        _answeredInRound = 1;
    }

    function decimals() external view override returns (uint8) {
        return _decimals;
    }

    function latestAnswer() external view override returns (uint256) {
        return uint256(_answer);
    }

    function latestRoundData()
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (_roundId, _answer, _startedAt, _updatedAt, _answeredInRound);
    }

    /**
     * @dev Set round data with all parameters
     */
    function setRoundData(
        uint80 roundId_,
        int256 answer_,
        uint256 startedAt_,
        uint256 updatedAt_,
        uint80 answeredInRound_
    ) external {
        _roundId = roundId_;
        _answer = answer_;
        _startedAt = startedAt_;
        _updatedAt = updatedAt_;
        _answeredInRound = answeredInRound_;
    }

    /**
     * @dev Set incomplete round data where answeredInRound < roundId
     */
    function setIncompleteRound(uint80 roundId_, int256 answer_) external {
        _roundId = roundId_;
        _answer = answer_;
        _startedAt = block.timestamp;
        _updatedAt = block.timestamp;
        _answeredInRound = roundId_ - 1; // Make answeredInRound < roundId
    }

    /**
     * @dev Update answer with normal round completion
     */
    function updateAnswer(int256 newAnswer_) external {
        _roundId++;
        _answer = newAnswer_;
        _startedAt = block.timestamp;
        _updatedAt = block.timestamp;
        _answeredInRound = _roundId;
    }
}
