// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

interface IMoneylineBets {
    enum Result {
        NONE, WIN, DRAW, LOSE
    }

    enum Status {
        NONE, OPEN, CLOSED, FINALIZED
    }

    struct Bet {
        bytes32 code;
        uint256 id;
        string teamA;
        string teamB;
        uint256 startsAt;
        uint256 endsAt;
        uint256 pricePerTicket;
        uint256 prizePerTicket;
        uint256 commissionPerTicket;
        uint256 injectedAmount;
        Result result;
        Status status;
        mapping(Result => address[]) choices;
        mapping(Result => uint256[]) counts;
        mapping(Result => uint256) accumulated;
        mapping(address => uint256) claimable;
    }

    struct BetView {
        bytes32 code;
        uint256 id;
        string teamA;
        string teamB;
        uint256 startsAt;
        uint256 endsAt;
        uint256 pricePerTicket;
        uint256 prizePerTicket;
        uint256 commissionPerTicket;
        uint256 injectedAmount;
        Result result;
        Status status;
        address[] winChoices;
        uint256[] winCounts;
        address[] loseChoices;
        uint256[] loseCounts;
        address[] drawChoices;
        uint256[] drawCounts;
        uint256 winAccumulated;
        uint256 loseAccumulated;
        uint256 drawAccumulated;
    }

    struct OpenBetRequest {
        string code;
        string teamA;
        string teamB;
        uint256 startsAt;
        uint256 endsAt;
        uint256 pricePerTicket;
        uint256 commissionPerTicket;
    }

    function makeBet(uint256 id, Result choice, uint256 ticketCount) external payable;

    function claimBet(uint256 id) external;

    function openBets(
        OpenBetRequest[] calldata requests
    ) external;

    function closeBets(
        uint256[] calldata ids,
        Result[] calldata results
    ) external;

    function finalizeBet(uint256 id, uint256 fromIdx, uint256 limit) external;

    function injectBet(uint256 id) external payable;

    function viewBets(uint256 fromId) external view returns (BetView[100] memory);
}