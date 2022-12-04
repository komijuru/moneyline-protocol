// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./IMoneylineBets.sol";

contract MoneylineBets is IMoneylineBets, AccessControl {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant INJECTOR_ROLE = keccak256("INJECTOR_ROLE");

    address payable public immutable treasury;

    uint256 public latestBetId;
    mapping(uint256 => Bet) public bets;

    event ClaimBet(address indexed from, uint256 indexed amount);
    event MakeBet(address indexed from, Result indexed choice, uint256 indexed ticketCount);
    event CommissionPayment(address indexed from, uint256 indexed commissionAmount);
    event OpenBet(uint256 indexed id, uint256 indexed startsAt, uint256 indexed endsAt, uint256 pricePerTicket);
    event CloseBet(uint256 indexed id, Result indexed result, uint256 indexed totalPrize);
    event FinalizeBet(uint256 indexed id, uint256 indexed fromIdx, uint256 indexed toIdx);
    event InjectBet(uint256 indexed id, uint256 indexed amount);

    constructor(address payable _treasury) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        treasury = _treasury;
    }

    // @dev Need a erc20 approval of total price of tickets
    function makeBet(uint256 id, Result choice, uint256 ticketCount) external payable {
        Bet storage bet = bets[id];
        require(choice != Result.NONE, "Cannot pick None");
        require(bet.status == Status.OPEN, "Not open");
        require(bet.startsAt <= block.timestamp && block.timestamp <= bet.endsAt, "Betting period is over");
        require(ticketCount * bet.pricePerTicket == msg.value, "Wrong amount of ether paid");

        bet.choices[choice].push(msg.sender);
        bet.counts[choice].push(ticketCount);
        bet.accumulated[choice] += ticketCount * (bet.pricePerTicket - bet.commissionPerTicket);

        if (bet.commissionPerTicket > 0) {
            emit CommissionPayment(msg.sender, ticketCount * bet.commissionPerTicket);
        }
        emit MakeBet(msg.sender, choice, ticketCount);
    }

    function claimBet(uint256 id) external {
        Bet storage bet = bets[id];
        require(bet.status == Status.FINALIZED, "Not finalized");
        require(bet.claimable[msg.sender] > 0, "Nothing to claim");
        uint256 amount = bet.claimable[msg.sender];
        (bool sent,) = payable(msg.sender).call{value : amount}("");
        require(sent, "Failed ether transfer");
        bet.claimable[msg.sender] = 0;
        emit ClaimBet(msg.sender, amount);
    }

    // @dev only operator
    function openBets(
        OpenBetRequest[] calldata requests
    ) external onlyRole(OPERATOR_ROLE) {
        for (uint256 i = 0; i < requests.length; i++) {
            OpenBetRequest memory request = requests[i];
            uint256 id = ++latestBetId;
            Bet storage bet = bets[id];
            require(
                keccak256(abi.encodePacked(request.teamA)) != ""
                && keccak256(abi.encodePacked(request.teamB)) != ""
                && keccak256(abi.encodePacked(request.teamA)) != keccak256(abi.encodePacked(request.teamB))
                && request.startsAt < request.endsAt, "Invalid request"
            );

            bet.code = keccak256(abi.encodePacked(request.code));
            bet.id = id;
            bet.teamA = request.teamA;
            bet.teamB = request.teamB;
            bet.startsAt = request.startsAt;
            bet.endsAt = request.endsAt;
            bet.pricePerTicket = request.pricePerTicket;
            bet.commissionPerTicket = request.commissionPerTicket;
            bet.prizePerTicket = 0;
            bet.result = Result.NONE;
            bet.status = Status.OPEN;
            emit OpenBet(id, request.startsAt, request.endsAt, request.pricePerTicket);
        }
    }

    // @dev only operator
    function closeBets(
        uint256[] calldata ids,
        Result[] calldata results
    ) external onlyRole(OPERATOR_ROLE) {
        require(ids.length == results.length, "Invalid input length");
        for (uint256 i = 0; i < ids.length; i++) {
            uint256 id = ids[i];
            Result result = results[i];
            Bet storage bet = bets[id];
            require(bet.status == Status.OPEN, "Not open");
            require(bet.result == Result.NONE, "Cannot pick None");

            bet.result = result;
            uint256 totalPrize = bet.injectedAmount;
            if (result == Result.WIN) {
                totalPrize += bet.accumulated[Result.DRAW];
                totalPrize += bet.accumulated[Result.LOSE];
            } else if (result == Result.LOSE) {
                totalPrize += bet.accumulated[Result.WIN];
                totalPrize += bet.accumulated[Result.DRAW];
            } else {
                totalPrize += bet.accumulated[Result.WIN];
                totalPrize += bet.accumulated[Result.LOSE];
            }
            if (bet.choices[bet.result].length != 0) {
                bet.prizePerTicket = totalPrize / bet.choices[bet.result].length;
            }
            bet.status = Status.CLOSED;

            emit CloseBet(id, result, totalPrize);
        }
    }

    // @dev only operator
    function finalizeBet(uint256 id, uint256 fromIdx, uint256 limit) external onlyRole(OPERATOR_ROLE) {
        Bet storage bet = bets[id];
        require(bet.status == Status.CLOSED, "Not closed");

        uint256 toIdx = fromIdx + limit;
        if (toIdx > bet.choices[bet.result].length) {
            toIdx = bet.choices[bet.result].length;
        }
        for (uint256 i = fromIdx; i < toIdx; i++) {
            bet.claimable[bet.choices[bet.result][i]] += bet.counts[bet.result][i] * bet.prizePerTicket;
        }
        bet.status = Status.FINALIZED;

        emit FinalizeBet(id, fromIdx, toIdx);
    }

    function injectBet(uint256 id) external payable onlyRole(INJECTOR_ROLE) {
        Bet storage bet = bets[id];
        require(bet.status == Status.OPEN || bet.status == Status.CLOSED, "Not open or closed");

        bet.injectedAmount = msg.value;

        emit InjectBet(id, msg.value);
    }

    function viewBets(uint256 fromId) external view returns (BetView[100] memory) {
        BetView[100] memory betViews;
        for (uint256 i = 0; i < 100; i++) {
            Bet storage bet = bets[fromId + i];
            betViews[i] = BetView(
                bet.code,
                bet.id,
                bet.teamA,
                bet.teamB,
                bet.startsAt,
                bet.endsAt,
                bet.pricePerTicket,
                bet.prizePerTicket,
                bet.commissionPerTicket,
                bet.injectedAmount,
                bet.result,
                bet.status,
                bet.choices[Result.WIN],
                bet.counts[Result.WIN],
                bet.choices[Result.LOSE],
                bet.counts[Result.LOSE],
                bet.choices[Result.DRAW],
                bet.counts[Result.DRAW],
                bet.accumulated[Result.WIN],
                bet.accumulated[Result.LOSE],
                bet.accumulated[Result.DRAW]
            );
        }
        return betViews;
    }
}
